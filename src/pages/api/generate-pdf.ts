import type {NextApiRequest, NextApiResponse} from 'next';
import puppeteer, {Browser, Page} from 'puppeteer-core'; // ✅ Import the type properly

const BROWSERLESS_TOKEN = process.env.SECRET_API_KEY;
const BROWSERLESS_WS = `${process.env.WSS_BROWSERLESS}?token=${BROWSERLESS_TOKEN}`;

const CHUNK_SIZE = 64 * 1024;
const PDF_TIMEOUT_MS = 30_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!BROWSERLESS_TOKEN) {
        return res.status(500).json({error: 'Missing Browserless token'});
    }

    if (req.method !== 'POST') {
        return res.status(405).json({error: 'Method Not Allowed'});
    }

    const {url} = req.body;
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
        return res.status(400).json({error: 'Invalid URL format'});
    }

    const keys = Object.keys(req.body);
    if (keys.length !== 1 || !keys.includes('url')) {
        return res.status(400).json({error: 'Unexpected request body'});
    }

    let browser: Browser | null = null;
    let clientAborted = false;

    try {
        browser = await puppeteer.connect({browserWSEndpoint: BROWSERLESS_WS});
        const page = await browser.newPage();

        const navigation = page.goto(url);
        const domReady = page.waitForFunction('document.readyState === "complete"');
        await Promise.all([navigation, domReady]);

        // Step 1: Scroll to trigger lazy-loaded elements
        await autoScroll(page);

        // Step 2: Give time for DOM to react to scroll
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

        // Step 3: Reload broken <img> tags by reassigning src
        await page.evaluate(() => {
            const images = Array.from(document.images);
            images.forEach((img) => {
                if (!img.complete || img.naturalHeight === 0) {
                    const src = img.getAttribute('src');
                    if (src) img.src = src; // Force reload
                }
            });
        });

        // Step 4: Wait until all <img> and background images finish loading
        await page.evaluate(async () => {
            const elements = Array.from(document.querySelectorAll('*'));

            await Promise.all(
                elements.map((el) => {
                    // Handle <img>
                    if (el.tagName === 'IMG') {
                        const img = el as HTMLImageElement;
                        if (img.complete) return;
                        return new Promise((resolve) => {
                            img.onload = img.onerror = resolve;
                        });
                    }

                    // Handle CSS background-image
                    const style = window.getComputedStyle(el);
                    const bgUrlMatch = style.backgroundImage.match(/url\("(.*)"\)/);
                    if (bgUrlMatch) {
                        return new Promise((resolve) => {
                            const bgImg = new Image();
                            bgImg.src = bgUrlMatch[1];
                            bgImg.onload = bgImg.onerror = resolve;
                        });
                    }
                })
            );
        });

        const timeout = new Promise<Buffer>((_, reject) =>
            setTimeout(() => reject(new Error('PDF generation timeout')), PDF_TIMEOUT_MS)
        );

        const pdfBuffer = await Promise.race([
            page.pdf({format: 'A4', printBackground: true}),
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('PDF generation error:', error?.message || error);
        await browser?.close();
        if (!res.headersSent) {
            res.status(500).json({error: 'Failed to generate PDF'});
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
async function autoScroll(page: Page): Promise<void> {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 300;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 300); // Slow scroll to trigger lazy loaders
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

