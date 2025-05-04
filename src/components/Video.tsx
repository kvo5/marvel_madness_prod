"use client";
import { IKVideo } from "imagekitio-next";

const urlEndpoint = process.env.NEXT_PUBLIC_URL_ENDPOINT;

type VideoTypes = {
  path: string;
  className?: string;
};

const Video = ({ path, className }: VideoTypes) => {
  return (
    <IKVideo
      urlEndpoint={urlEndpoint}
      path={path}
      className={className}
      // Add quality transformation if desired
      // Note: The 'raw' transformation for text overlay is also removed as it might interfere without fixed dimensions. Add back if needed with adjustments.
      transformation={[{ q: "90" }]}
      controls
    />
  );
};

export default Video;
