"use client";

import React, { useActionState, useEffect, useRef, useState } from "react";
import CustomImage from "@/components/Image"; // Alias custom component for icons
import NextImage from "next/image"; // Use standard next/image for avatar and previews
import ImageEditor from "@/components/ImageEditor";
import { useUser } from "@clerk/nextjs";
import { addPost } from "@/action";
import { useRouter } from "next/navigation";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useQueryClient } from "@tanstack/react-query";

const PostModal = () => {
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

  const router = useRouter();
  const { user } = useUser();

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMedia(e.target.files[0]);
    }
  };

  const handleEmoji = (e: { emoji: string }) => {
    setDesc((prev) => prev + e.emoji);
    setShowEmojiPicker(false);
  };

  const previewURL = media ? URL.createObjectURL(media) : null;

  const [state, formAction, isPending] = useActionState(addPost, {
    success: false,
    error: false,
  });

  const formRef = useRef<HTMLFormElement | null>(null);
  const textRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setMedia(null);
      setDesc("");
      setSettings({ type: "original", sensitive: false });
      // Invalidate the posts query to refetch the feed
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      router.back(); // Close modal on success
    }
  }, [state, router, queryClient]);

  const closeModal = () => {
    router.back();
  };

  return (
    <div className="absolute w-screen h-screen top-0 left-0 z-20 bg-[#293139a6] flex justify-center">
      <form
        ref={formRef}
        action={formAction}
        className="py-4 px-8 rounded-xl bg-black w-[600px] h-max mt-12 flex flex-col gap-4"
      >
        {/* TOP */}
        <div className="flex items-center justify-between">
          <div className="cursor-pointer" onClick={closeModal}>
            X
          </div>
          <div className="text-iconBlue font-bold">Drafts</div>
        </div>
        {/* CENTER */}
        <div className="flex gap-4">
          <div className="relative w-10 h-10 rounded-full overflow-hidden">
            {/* Use standard next/image for avatar */}
            <NextImage
              // Prioritize publicMetadata.imageUrl, fallback to imageUrl, then static image
              src={user?.publicMetadata?.imageUrl as string || user?.imageUrl || "/general/noAvatar.png"}
              alt="User Avatar"
              fill // Use fill to cover the container
              className="object-cover" // Ensure image covers the area
            />
          </div>
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
              ref={textRef}
              type="text"
              name="desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
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
            {/* PREVIEW VIDEO */}
            {media?.type.includes("video") && previewURL && (
              <div className="relative">
                <video src={previewURL} controls className="w-full rounded-lg" />
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
          </div>
        </div>
        {/* BOTTOM */}
        <div className=" flex items-center justify-between gap-4 flex-wrap border-t border-borderYellow pt-4">
          <div className="flex gap-4 flex-wrap relative">
            <input
              type="file"
              name="file"
              onChange={handleMediaChange}
              className="hidden"
              id="fileModal" // Use a different ID to avoid conflicts
              accept="image/*,video/*"
            />
            <label htmlFor="fileModal">
              <CustomImage
                path="icons/image.svg"
                alt="Add media"
                w={20}
                h={20}
                className="cursor-pointer"
              />
            </label>
            <div onClick={() => setShowEmojiPicker((prev) => !prev)}>
              <CustomImage
                path="icons/emoji.svg"
                alt="Add emoji"
                w={20}
                h={20}
                className="cursor-pointer"
              />
            </div>
            {showEmojiPicker && (
              <div className="absolute top-8 left-0 z-30">
                <EmojiPicker
                  theme={Theme.DARK}
                  onEmojiClick={handleEmoji}
                />
              </div>
            )}
          </div>
          <button
            className="py-2 px-5 text-black bg-white rounded-full font-bold disabled:cursor-not-allowed disabled:bg-slate-200"
            disabled={isPending || (!desc && !media)} // Disable if pending or no content
          >
            {isPending ? "Posting..." : "Post"}
          </button>
        </div>
        {state.error && (
          <span className="text-red-300 p-4">Something went wrong!</span>
        )}
      </form>
    </div>
  );
};

export default PostModal;
