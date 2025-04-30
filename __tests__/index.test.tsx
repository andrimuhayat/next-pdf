import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Home from '../src/pages/index';

beforeAll(() => {
    global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/fake-pdf-url');
});

afterEach(() => {
    (global.URL.createObjectURL as jest.Mock).mockReset();
});


describe('PDF Generator Page', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders input and button', () => {
        render(<Home />);
        expect(screen.getByPlaceholderText(/enter webpage url/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /generate pdf/i })).toBeDisabled();
    });

    it('enables the button when URL is entered', () => {
        render(<Home />);
        const input = screen.getByPlaceholderText(/enter webpage url/i);
        fireEvent.change(input, { target: { value: 'https://example.com' } });
        expect(screen.getByRole('button', { name: /generate pdf/i })).not.toBeDisabled();
    });

    it('shows loading spinner and cancel button on generate', async () => {
        // Simulate PDF chunks like a Puppeteer stream
        const read = jest
            .fn()
            .mockImplementationOnce(async () => {
                await new Promise((res) => setTimeout(res, 100)); // simulate delay
                return { done: false, value: new Uint8Array([1, 2, 3]) };
            })
            .mockResolvedValueOnce({ done: true });

        // Mock fetch to return a stream with our mock reader
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                body: {
                    getReader: () => ({ read }),
                },
            })
        ) as jest.Mock;

        render(<Home />);

        // Fill in the input
        const input = screen.getByPlaceholderText(/enter webpage url/i);
        fireEvent.change(input, { target: { value: 'https://example.com' } });

        // Click Generate PDF
        fireEvent.click(screen.getByRole('button', { name: /generate pdf/i }));

        // ✅ Wait for spinner and cancel button to appear
        expect(await screen.findByText(/loading/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

        // ✅ Wait for final toast after stream completes
        const toast = await screen.findByText(/PDF generated successfully!/i);
        expect(toast).toBeInTheDocument();
    });


    it('shows error toast when fetch fails', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: false,
                json: () => Promise.resolve({ error: 'Mocked error' }),
            })
        ) as jest.Mock;

        render(<Home />);
        const input = screen.getByPlaceholderText(/enter webpage url/i);
        fireEvent.change(input, { target: { value: 'https://error.com' } });
        fireEvent.click(screen.getByRole('button', { name: /generate pdf/i }));

        await waitFor(() =>
            expect(screen.getByText(/mocked error/i)).toBeInTheDocument()
        );
    });
});
