import React, { useRef, useState, useEffect, useMemo } from 'react';

interface VirtualListProps<T> {
    items: T[];
    height: number | string; // Container height (px or '100%')
    itemHeight: number;
    renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
    className?: string;
    buffer?: number;
}

export function VirtualList<T>({
    items,
    height,
    itemHeight,
    renderItem,
    className = '',
    buffer = 5
}: VirtualListProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    // Initial measure
    useEffect(() => {
        if (containerRef.current) {
            setContainerHeight(containerRef.current.clientHeight);

            const handleResize = () => {
                if (containerRef.current) {
                    setContainerHeight(containerRef.current.clientHeight);
                }
            };

            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, []);

    // Handle scroll
    const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    // Calculate visible range
    const { startIndex, endIndex, totalHeight } = useMemo(() => {
        const total = items.length * itemHeight;
        const effectiveHeight = typeof height === 'number' ? height : containerHeight;

        if (effectiveHeight === 0) return { startIndex: 0, endIndex: 0, totalHeight: total };

        const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
        const visibleCount = Math.ceil(effectiveHeight / itemHeight) + 2 * buffer;
        const end = Math.min(items.length, start + visibleCount);

        return { startIndex: start, endIndex: end, totalHeight: total };
    }, [items.length, itemHeight, scrollTop, height, containerHeight, buffer]);

    const visibleItems = useMemo(() => {
        const result = [];
        for (let i = startIndex; i < endIndex; i++) {
            const style: React.CSSProperties = {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${itemHeight}px`,
                transform: `translateY(${i * itemHeight}px)`,
            };
            result.push(renderItem(items[i], i, style));
        }
        return result;
    }, [items, startIndex, endIndex, itemHeight, renderItem]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                height: height,
                overflowY: 'auto',
                position: 'relative'
            }}
            onScroll={onScroll}
        >
            <div style={{ height: totalHeight, position: 'relative', width: '100%' }}>
                {visibleItems}
            </div>
        </div>
    );
}
