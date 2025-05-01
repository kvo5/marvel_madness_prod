import Link from "next/link";
import CustomImage from "./Image"; // Alias the custom component for icons
import NextImage from "next/image"; // Import standard next/image for avatar
import Socket from "./Socket";
import Notification from "./Notification";
import { currentUser } from "@clerk/nextjs/server";
import Logout from "@/components/Logout"; // Use path alias


const LeftBar = async () => {
  const user = await currentUser();

  // Define menuList inside the component to access 'user'
  const menuList = [
     {
      id: 3, // Original ID for Homepage
      name: "Homepage",
      link: "/",
      icon: "home.svg",
    },
     {
      id: 7, // Original ID for Teams
      name: "Teams",
      link: "/teams",
      icon: "community.svg",
    },
    {
      id: 9, // Original ID for Profile
      name: "Profile",
      link: `/${user?.username || ''}`, // Dynamic link
      icon: "profile.svg",
    },
    {
      id: 10, // Original ID for Settings
      name: "Settings",
      link: "/settings", // Point to the new settings page
      icon: "settings.svg",
    },
  ];


  return (
    <div className="h-screen sticky top-0 flex flex-col justify-between pt-2 pb-8">
      {/* LOGO MENU BUTTON */}
      <div className="flex flex-col gap-4 text-lg items-center xxl:items-start">
        {/* LOGO */}
        <Link href="/" className="p-2 rounded-full hover:bg-[#181818] ">
          <CustomImage path="icons/logo.svg" alt="logo" w={210} h={210} />
        </Link>
        {/* MENU LIST */}
        <div className="flex flex-col gap-4">
          {menuList.map((item, i) => (
            <div key={item.id || i}>
              {i === 1 && user && (
                <div>
                  <Notification />
                </div>
              )}
              <Link
                // Use user?.username for the profile link specifically
                href={item.name === "Profile" ? `/${user?.username || ''}` : item.link}
                className="p-2 rounded-full hover:bg-[#181818] flex items-center gap-4"
              >
                <CustomImage
                  path={`icons/${item.icon}`}
                  alt={item.name}
                  w={24}
                  h={24}
                />
                <span className="hidden xxl:inline">{item.name}</span>
              </Link>
            </div>
          ))}
        </div>
        {/* BUTTON */}
        <Link
          href="/compose/post"
          className="bg-white text-black rounded-full w-12 h-12 flex items-center justify-center xxl:hidden"
        >
          <CustomImage path="icons/post.svg" alt="new post" w={24} h={24} />
        </Link>
        <Link
          href="/compose/post"
          className="hidden xxl:block bg-white text-black rounded-full font-bold py-2 px-20"
        >
          Post
        </Link>
      </div>
      {user && (
        <>
          <Socket />
          {/* USER */}
          <div className="flex items-center justify-between border border-borderYellow rounded-lg p-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 relative rounded-full overflow-hidden">
                {/* Use standard next/image for the avatar */}
                <NextImage
                  // Prioritize publicMetadata.imageUrl, fallback to imageUrl, then static image
                  src={user?.publicMetadata?.imageUrl as string || user?.imageUrl || "/general/noAvatar.png"}
                  alt="User Avatar"
                  fill // Use fill to cover the container
                  className="object-cover" // Ensure image covers the area
                />
              </div>
              <div className="hidden xxl:flex flex-col">
                <span className="font-bold">{user?.username}</span>
                <span className="text-sm text-textGray">@{user?.username}</span>
              </div>
            </div>
            {/* <div className="hidden xxl:block cursor-pointer font-bold">...</div> */}
            {/* ADD LOGOUT */}
            <Logout/>
          </div>
        </>
      )}
    </div>
  );
};

export default LeftBar;