'use client';

import { useState, useEffect } from 'react';

const images = [
  "https://i.ibb.co.com/HfWcTfx2/Whats-App-Image-2026-07-18-at-09-34-41.jpg",
  "https://i.ibb.co.com/JRfrJnBj/Gemini-Generated-Image-qckfa1qckfa1qckf.png"
];

export default function BackgroundSlideshow({ className = "bg-cover bg-center bg-no-repeat bg-fixed" }: { className?: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {images.map((src, index) => (
        <div
          key={src}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out pointer-events-none ${
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          style={{ 
            backgroundImage: `url('${src}')`,
            zIndex: -1
          }}
        />
      ))}
    </>
  );
}
