import Feed from "@/components/Feed";
import Share from "@/components/Share";
import Link from "next/link";

const Homepage = () => {

  return <div className="">
    <div className='px-4 pt-4 flex justify-between text-textGray font-bold border-b-[1px] border-borderYellow'>
      <Link className="pb-3 flex items-center" href="/">Feed</Link> {/* Remove active style */}
      <Link className="pb-3 flex items-center" href="/following">Following</Link> {/* Update href */}
      <Link className="hidden pb-3 md:flex items-center" href="/">Scrims</Link>
      <Link className="hidden pb-3 md:flex items-center" href="/">Draft</Link>
    </div>
    <Share/>
    <Feed/>
  </div>;
};

export default Homepage;