"use client";

import React, { useActionState, useEffect, useRef, useState } from "react";
import CustomImage from "./Image"; // Alias the custom component
import NextImage from "next/image"; // Keep next/image
import ImageEditor from "./ImageEditor";
import { useUser } from "@clerk/nextjs";
import { addPost } from "@/action";
import { useQueryClient } from "@tanstack/react-query";
import EmojiPicker, { Theme } from "emoji-picker-react";

const Share = () => {
  const queryClient = useQueryClient();
  const [media, setMedia] = useState<File | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [settings, setSettings] = useState<{
    type: "original" | "wide" | "square";
    sensitive: boolean;
  }>({
    type: "original",
    sensitive: false,
  });

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMedia(e.target.files[0]);
    }
  };

  const previewURL = media ? URL.createObjectURL(media) : null;

  const { user } = useUser();

  const [state, formAction, isPending] = useActionState(addPost, {
    success: false,
    error: false,
  });

  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setMedia(null);
      setDesc(""); // Reset description
      setSettings({ type: "original", sensitive: false });
      // queryClient.invalidateQueries({ queryKey: ["posts"] });
    }
    // We can remove queryClient from dependency array if it's no longer used in the effect
  }, [state]);

  const handleEmoji = (e: { emoji: string }) => {
    setDesc((prev) => prev + e.emoji);
    setShowEmojiPicker(false);
  };


  return (
    <form
      ref={formRef}
      className="p-4 flex gap-4"
      // action={(formData) => shareAction(formData, settings)}
      action={formAction}
    >
      {/* AVATAR */}
      <div className="relative w-10 h-10 rounded-full overflow-hidden">
        {/* Use standard next/image */}
        <NextImage
          // Prioritize publicMetadata.imageUrl, fallback to imageUrl, then static image
          src={user?.publicMetadata?.imageUrl as string || user?.imageUrl || "/general/noAvatar.png"}
          alt="User Avatar"
          fill // Use fill to cover the container
          className="object-cover" // Ensure image covers the area
        />
      </div>
      {/* OTHERS */}
      <div className="flex-1 flex flex-col gap-4">
        <input
          type="text"
          name="imgType"
          value={settings.type}
          hidden
          readOnly
        />
        <input
          type="text"
          name="isSensitive"
          value={settings.sensitive ? "true" : "false"}
          hidden
          readOnly
        />
        <input
          type="text"
          name="desc"
          value={desc} // Bind value to state
          onChange={(e) => setDesc(e.target.value)} // Update state on change
          placeholder="What is happening?!"
          className="bg-transparent outline-none placeholder:text-textGray text-xl"
        />
        {/* PREVIEW IMAGE */}
        {media?.type.includes("image") && previewURL && (
          <div className="relative rounded-xl overflow-hidden">
            <NextImage
              src={previewURL}
              alt=""
              width={600}
              height={600}
              className={`w-full ${
                settings.type === "original"
                  ? "h-full object-contain"
                  : settings.type === "square"
                  ? "aspect-square object-cover"
                  : "aspect-video object-cover"
              }`}
            />
            <div
              className="absolute top-2 left-2 bg-black bg-opacity-50 text-white py-1 px-4 rounded-full font-bold text-sm cursor-pointer"
              onClick={() => setIsEditorOpen(true)}
            >
              Edit
            </div>
            <div
              className="absolute top-2 right-2 bg-black bg-opacity-50 text-white h-8 w-8 flex items-center justify-center rounded-full cursor-pointer font-bold text-sm"
              onClick={() => setMedia(null)}
            >
              X
            </div>
          </div>
        )}
        {media?.type.includes("video") && previewURL && (
          <div className="relative">
            <video src={previewURL} controls />
            <div
              className="absolute top-2 right-2 bg-black bg-opacity-50 text-white h-8 w-8 flex items-center justify-center rounded-full cursor-pointer font-bold text-sm"
              onClick={() => setMedia(null)}
            >
              X
            </div>
          </div>
        )}
        {isEditorOpen && previewURL && (
          <ImageEditor
            onClose={() => setIsEditorOpen(false)}
            previewURL={previewURL}
            settings={settings}
            setSettings={setSettings}
          />
        )}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Make this div relative for emoji picker positioning */}
          <div className="flex gap-4 flex-wrap relative">
            <input
              type="file"
              name="file"
              onChange={handleMediaChange}
              className="hidden"
              id="file"
              accept="image/*,video/*"
            />
            <label htmlFor="file">
              {/* Use aliased custom image for icons if needed */}
              <CustomImage
                path="icons/image.svg"
                alt=""
                w={20}
                h={20}
                className="cursor-pointer"
              />
            </label>
            <div onClick={() => setShowEmojiPicker((prev) => !prev)}>
               {/* Use aliased custom image for icons if needed */}
              <CustomImage
                path="icons/emoji.svg"
                alt="Add emoji"
                w={20}
                h={20}
                className="cursor-pointer"
              />
            </div>
             {showEmojiPicker && (
              /* Adjust positioning: top-8 to appear below the icon, left-0 */
              <div className="absolute top-8 left-0 z-30">
                <EmojiPicker
                  theme={Theme.DARK}
                  onEmojiClick={handleEmoji}
                />
              </div>
            )}
          </div>
          <button
            className="bg-white text-black font-bold rounded-full py-2 px-4 disabled:cursor-not-allowed disabled:bg-slate-200" // Added disabled style
            disabled={isPending || (!desc && !media)} // Disable if pending or no content
          >
            {isPending ? "Posting..." : "Post"}
          </button>
          {state.error && (
            <span className="text-red-300 p-4">Something went wrong!</span>
          )}
        </div>
      </div>
    </form>
  );
};

export default Share;