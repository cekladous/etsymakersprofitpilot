import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Closes any open Radix dialogs/sheets/popovers when the route changes.
 * Radix UI components listen for Escape on the document and close on it.
 * This prevents "ghost" modal backdrops from lingering after navigation.
 */
export default function ModalCleanup() {
    const location = useLocation();

    useEffect(() => {
        // Dispatch Escape to close any open dialogs/sheets/popovers
        const escapeEvent = new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            keyCode: 27,
            bubbles: true,
            cancelable: true,
        });
        document.dispatchEvent(escapeEvent);

        // Fallback: remove any orphaned Radix portal overlays left in the DOM
        requestAnimationFrame(() => {
            const orphaned = document.querySelectorAll('[data-radix-portal] [data-state="open"]');
            orphaned.forEach(el => {
                if (el.getAttribute('role') === 'dialog' || el.tagName === 'DIV') {
                    el.setAttribute('data-state', 'closed');
                }
            });
        });
    }, [location.pathname]);

    return null;
}