import type { NextApiRequest, NextApiResponse } from 'next';
import puppeteer from 'puppeteer-core';

const BROWSERLESS_TOKEN = process.env.SECRET_API_KEY;
const BROWSERLESS_WS = `${process.env.WSS_BROWSERLESS}?token=${BROWSERLESS_TOKEN}`;

const CHUNK_SIZE = 64 * 1024;
const PDF_TIMEOUT_MS = 30_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!BROWSERLESS_TOKEN) {
        return res.status(500).json({ error: 'Missing Browserless token' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { url } = req.body;
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    const keys = Object.keys(req.body);
    if (keys.length !== 1 || !keys.includes('url')) {
        return res.status(400).json({ error: 'Unexpected request body' });
    }

    let browser: puppeteer.Browser | null = null;
    let clientAborted = false;

    try {
        browser = await puppeteer.connect({ browserWSEndpoint: BROWSERLESS_WS });
        const page = await browser.newPage();

        const navigation = page.goto(url);
        const domReady = page.waitForFunction('document.readyState === "complete"');
        await Promise.all([navigation, domReady]);

        // Scroll to trigger all lazy-loaded images
        await autoScroll(page);

        // Wait until all images finish loading
        await page.evaluate(async () => {
            const images = Array.from(document.images);
            await Promise.all(
                images.map(img => {
                    if (img.complete) return;
                    return new Promise(resolve => {
                        img.onload = img.onerror = resolve;
                    });
                })
            );
        });

        const timeout = new Promise<Buffer>((_, reject) =>
            setTimeout(() => reject(new Error('PDF generation timeout')), PDF_TIMEOUT_MS)
        );

        const pdfBuffer = await Promise.race([
            page.pdf({ format: 'A4', printBackground: true }),
            timeout,
        ]);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="webpage.pdf"');
        res.setHeader('Content-Length', pdfBuffer.length.toString());
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Connection', 'keep-alive');

        const start = Date.now();

        req.on('close', async () => {
            clientAborted = true;
            console.warn('Client disconnected early');
            if (browser) {
                try {
                    await browser.close();
                } catch (err) {
                    console.error('Error closing browser on client disconnect:', err);
                }
            }
        });

        for (let offset = 0; offset < pdfBuffer.length; offset += CHUNK_SIZE) {
            if (clientAborted) return;
            const chunk = pdfBuffer.slice(offset, offset + CHUNK_SIZE);
            res.write(chunk);
        }

        if (!clientAborted) {
            res.end();
            console.log(`✅ PDF streamed in ${Date.now() - start}ms`);
        }

    } catch (error: any) {
        console.error('PDF generation error:', error?.message || error);
        await browser?.close();
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate PDF' });
        }
    } finally {
        if (!clientAborted && browser) {
            try {
                await browser.close();
            } catch (err) {
                console.error('Browser close error:', err);
            }
        }
    }
}

//  Auto-scroll to bottom to trigger lazy-loaded images
async function autoScroll(page: puppeteer.Page) {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 300;
            const timer = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= document.body.scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

export const config = {
    api: {
        // bodyParser: false,
        responseLimit: false,
        externalResolver: true,
    },
};
