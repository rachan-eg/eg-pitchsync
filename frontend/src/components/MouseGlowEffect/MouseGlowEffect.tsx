import React, { useEffect, useRef } from 'react';

/**
 * MouseGlowEffect - A component that tracks mouse position globally
 * and provides reactive border glow effects to elements with the 
 * 'reactive-border' class.
 * 
 * Mount this once at the app root level.
 */
export const MouseGlowEffect: React.FC = () => {
    const rafRef = useRef<number | null>(null);
    const mousePos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePos.current = { x: e.clientX, y: e.clientY };

            // Cancel any pending animation frame
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }

            // Use requestAnimationFrame for smooth performance
            rafRef.current = requestAnimationFrame(() => {
                const elements = document.querySelectorAll('.reactive-border');

                elements.forEach((element) => {
                    const rect = element.getBoundingClientRect();
                    const elementCenterX = rect.left + rect.width / 2;
                    const elementCenterY = rect.top + rect.height / 2;

                    // Calculate distance from mouse to element center
                    const dx = mousePos.current.x - elementCenterX;
                    const dy = mousePos.current.y - elementCenterY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // Calculate relative position within the element
                    const relativeX = mousePos.current.x - rect.left;
                    const relativeY = mousePos.current.y - rect.top;

                    // Calculate glow intensity based on distance (max 400px range)
                    const maxDistance = 400;
                    const intensity = Math.max(0, 1 - distance / maxDistance);

                    // Set CSS custom properties for the glow effect
                    const el = element as HTMLElement;
                    el.style.setProperty('--mouse-x', `${relativeX}px`);
                    el.style.setProperty('--mouse-y', `${relativeY}px`);
                    el.style.setProperty('--glow-intensity', intensity.toString());

                    // Calculate angle for directional glow
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    el.style.setProperty('--glow-angle', `${angle}deg`);
                });
            });
        };

        // Add mousemove listener to the entire document
        document.addEventListener('mousemove', handleMouseMove, { passive: true });

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, []);

    // This component doesn't render anything visible
    return null;
};

export default MouseGlowEffect;
