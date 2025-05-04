"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";
const Logout = () => {
  const [open, setOpen] = useState(false);
  const { signOut } = useClerk();

  return (
    <div className="hidden xxl:block relative">
      <div
        className="cursor-pointer font-bold"
        onClick={() => setOpen((prev) => !prev)}
      >
        ...
      </div>
      {open && (
        <div className="bg-white py-6 px-8 rounded-xl absolute left-4 bottom-4 flex flex-col">
          <button
            className="bg-black rounded-md px-2 py-1"
            onClick={() => signOut()}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default Logout;