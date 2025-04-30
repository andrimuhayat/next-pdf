import {useState, useRef} from 'react';

export default function Home() {
    const [url, setUrl] = useState('');
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const lastProgressRef = useRef(0);
    const [cancelling, setCancelling] = useState(false);
    const controllerRef = useRef<AbortController | null>(null);

    const handleCancel =  async () => {
        if (controllerRef.current) {
            setCancelling(true);            // 👈 Mark cancelling
            controllerRef.current?.abort('previous generation cancelled'); // 🚫 Abort fetch
            controllerRef.current = null;
        }
    };
    const handleGeneratePdf = async () => {
        setLoading(true);
        setToast(null);
        setPdfBlobUrl(null);

        if (controllerRef.current) {
            controllerRef.current?.abort('previous generation cancelled');
        }

        const controller = new AbortController();
        controllerRef.current = controller;

        try {
            const response = await fetch('/api/generate-pdf', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({url}),
                signal: controller.signal, // ✅ Important: Attach AbortController
            });

            if (!response.ok) {
                const {error} = await response.json();
                throw new Error(error || 'Failed to generate PDF');
            }

            const reader = response.body?.getReader();
            const chunks: Uint8Array[] = [];

            while (true) {
                const {done, value} = await reader!.read();
                if (done) break;
                if (value) {
                    chunks.push(value);
                }
            }

            const blob = new Blob(chunks, {type: 'application/pdf'});
            const blobUrl = URL.createObjectURL(blob);
            setPdfBlobUrl(blobUrl);

            setToast({message: 'PDF generated successfully!', type: 'success'});

        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.warn('PDF generation cancelled by user');
                setToast({message: '🚫 PDF generation cancelled', type: 'error'});
            } else {
                console.error(err);
                setToast({message: err.message || 'Something went wrong', type: 'error'});
            }
        } finally {
            setLoading(false);
            setCancelling(false);
            controllerRef.current = null;
        }
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.heading}>PDF Generator (Streaming)</h1>

            <input
                type="text"
                placeholder="Enter webpage URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={styles.input}
            />

            <button
                onClick={handleGeneratePdf}
                disabled={loading || !url}
                style={{
                    ...styles.button,
                    ...(loading || !url ? styles.buttonDisabled : {}), // 👈 add this
                }}
            >
                {loading ? 'Generating...' : 'Generate PDF'}
            </button>
            {loading && (
                <button
                    onClick={handleCancel}
                    disabled={cancelling} // 👈 Disable it if cancelling
                    style={{
                        ...styles.cancelButton,
                        ...(cancelling ? styles.buttonDisabled : {}),
                    }}
                >
                    {cancelling ? 'Cancelling...' : 'Cancel'}
                </button>
            )}

            {loading && (
                <div style={styles.loadingContainer}>
                    <div style={styles.spinner}/>
                    <p>Loading</p>
                </div>
            )}

            {toast && (
                <div style={{...styles.toast, backgroundColor: toast.type === 'success' ? '#4caf50' : '#f44336'}}>
                    {toast.message}
                </div>
            )}

            {pdfBlobUrl && (
                <div style={styles.previewContainer}>
                    <h2 style={styles.subHeading}>PDF Preview</h2>
                    <iframe
                        src={pdfBlobUrl}
                        title="PDF Preview"
                        style={styles.iframe}
                    />
                    <br/>
                    <a href={pdfBlobUrl} download="generated.pdf" style={styles.downloadLink}>
                        Download PDF
                    </a>
                </div>
            )}
        </div>
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    loadingContainer: {
        marginTop: '30px',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        color: '#555',
        fontSize: '1.2rem',
    },
    spinner: {
        width: '50px',
        height: '50px',
        border: '5px solid #ccc',
        borderTop: '5px solid #0070f3', // blue top border
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '10px',
    },
    container: {
        maxWidth: '700px',
        margin: '40px auto',
        padding: '20px',
        fontFamily: 'sans-serif',
        textAlign: 'center',
    },
    heading: {
        fontSize: '2rem',
        marginBottom: '20px',
    },
    input: {
        width: '100%',
        padding: '12px',
        fontSize: '1rem',
        marginBottom: '10px',
    },
    button: {
        padding: '12px 24px',
        fontSize: '1rem',
        backgroundColor: '#0070f3',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        marginBottom: '20px',
        transition: 'background-color 0.3s',
    },
    buttonDisabled: {
        marginLeft: '5px',
        backgroundColor: '#cccccc',   // gray background
        cursor: 'not-allowed',         // no pointer on hover
        color: '#666666',              // dim the text
    },
    cancelButton: {
        marginLeft: '5px',
        padding: '12px 24px',
        fontSize: '1rem',
        backgroundColor: '#f44336', // Red
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        marginTop: '10px',
        marginBottom: '20px',
    },
    progressContainer: {
        width: '100%',
        backgroundColor: '#eee',
        borderRadius: '6px',
        overflow: 'hidden',
        marginTop: '10px',
    },
    progressBar: {
        height: '10px',
        backgroundColor: '#4caf50',
        transition: 'width 0.2s ease-in-out',
    },
    toast: {
        padding: '12px',
        borderRadius: '6px',
        marginTop: '20px',
        color: 'white',
    },
    previewContainer: {
        marginTop: '30px',
    },
    subHeading: {
        fontSize: '1.5rem',
        marginBottom: '10px',
    },
    iframe: {
        width: '100%',
        height: '600px',
        border: '1px solid #ccc',
        marginBottom: '20px',
    },
    downloadLink: {
        display: 'inline-block',
        marginTop: '10px',
        padding: '12px 24px',
        backgroundColor: '#28a745',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '6px',
    },
};
