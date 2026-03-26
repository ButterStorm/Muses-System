'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 自定义Hook - 用于检测元素是否进入视口
 * @param options - IntersectionObserver 配置选项
 * @returns ref 和 isVisible 状态
 */
export const useScrollAnimation = (options = {}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                // 一旦元素可见，停止观察以提高性能
                if (ref.current) {
                    observer.unobserve(ref.current);
                }
            }
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px',
            ...options,
        });

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => {
            if (ref.current) {
                observer.unobserve(ref.current);
            }
        };
    }, []);

    return { ref, isVisible };
};
