"use client";

import Image from 'next/image'; // Import next/image for optimized local/external images
import { IKImage } from "imagekitio-next";

type ImageType = {
  path?: string; // Primarily for ImageKit paths OR local paths starting with /
  src?: string; // Primarily for full external URLs
  w?: number;
  h?: number;
  alt: string;
  className?: string;
  tr?: boolean; // ImageKit specific transformation flag
};

const urlEndpoint = process.env.NEXT_PUBLIC_URL_ENDPOINT;

// No longer throwing error here, handle missing endpoint conditionally
// if (!urlEndpoint) {
//   throw new Error('Error: Please add urlEndpoint to .env or .env.local')
// }

const CustomImage = ({ path, src, w, h, alt, className, tr }: ImageType) => {
  const width = w;
  const height = h;

  // Priority 1: External URL via src prop
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        unoptimized // Add this if external domains aren't configured in next.config.js
      />
    );
  }

  // Priority 2: Local path or external URL via path prop
  if (path) {
    // Check if it's a local public path or a full URL
    if (path.startsWith('/') || path.startsWith('http')) {
       return (
         <Image
           src={path} // Use path directly as src for next/image
           alt={alt}
           width={width}
           height={height}
           className={className}
           unoptimized={path.startsWith('http')} // Unoptimize external URLs if needed
         />
       );
    }
    // Priority 3: ImageKit path via path prop
    else if (urlEndpoint) {
      // Only use IKImage if urlEndpoint is configured and path is not local/external
      return (
        <IKImage
          urlEndpoint={urlEndpoint}
          path={path}
          // src={src} // src is handled above
          {...(tr
            ? { transformation: [{ width: `${width}`, height: `${height}` }] }
            : { width: width, height: height })}
          lqip={{ active: true, quality: 20 }}
          alt={alt}
          className={className}
        />
      );
    }
  }

  // Fallback: Render a placeholder or nothing if no valid source
  // For now, let's render a simple div matching the size, or null
   if (width && height) {
    return <div className={className} style={{ width: `${width}px`, height: `${height}px`, backgroundColor: '#ccc' }} aria-label={alt}></div>;
   }
   return null; // Or some other fallback
};

export default CustomImage; // Renamed component to avoid conflict with next/image import