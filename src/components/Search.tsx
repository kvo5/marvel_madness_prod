"use client";

import Image from "./Image";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";

// Define a type for the user data we expect from the API
type SearchUser = {
  id: string;
  username: string;
  displayName: string | null;
  img: string | null;
};

// Simple debounce function
// Use specific generics A for args array type, R for the original function's return type.
// The debounced function itself returns void.
const debounce = <A extends unknown[], R>(func: (...args: A) => R, waitFor: number): ((...args: A) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  // The debounced function takes arguments of type A and returns void.
  const debounced = (...args: A): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
      // Reset timeout to null after clearing
      timeout = null;
    }
    // Call the original function, ignoring its return value R.
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced;
};


const Search = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const fetchUsers = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/search?query=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data: SearchUser[] = await response.json();
      setResults(data);
      setShowResults(data.length > 0);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setResults([]);
      setShowResults(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced version of fetchUsers
  const debouncedFetchUsers = useCallback(debounce(fetchUsers, 300), []); // 300ms debounce

  useEffect(() => {
    debouncedFetchUsers(query);
  }, [query, debouncedFetchUsers]);

  // Handle clicks outside the search container to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!e.target.value.trim()) {
        setShowResults(false); // Hide results immediately if input is cleared
    }
  };

  const handleResultClick = () => {
    setQuery(""); // Clear input on result click
    setResults([]);
    setShowResults(false);
  };

  return (
    <div className="relative" ref={searchContainerRef}>
      <div className="bg-periwinkleGrey py-2 px-4 flex items-center gap-4 rounded-full">
        <Image path="icons/explore.svg" alt="search" w={16} h={16} />
        <input
          type="text"
          placeholder="Search for users"
          className="bg-transparent outline-none placeholder:text-textGray w-full"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.trim() && results.length > 0 && setShowResults(true)} // Show results on focus if there are any
        />
      </div>
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a202c] border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"> {/* Forced solid background color, removed bg-bgPrimary/bg-opacity-100 */}
          {isLoading ? (
            <div className="p-4 text-textGray text-center">Loading...</div>
          ) : results.length > 0 ? (
            results.map((user) => (
              <Link
                href={`/${user.username}`}
                key={user.id}
                className="flex items-center gap-3 p-3 hover:bg-inputBlack cursor-pointer"
                onClick={handleResultClick}
              >
                <Image
                  path={user.img || "/general/post.jpeg"} // Corrected default avatar path
                  alt={user.username}
                  w={40}
                  h={40}
                  className="rounded-full"
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-textPrimary">
                    {user.displayName || user.username}
                  </span>
                  <span className="text-sm text-textGray">@{user.username}</span>
                </div>
              </Link>
            ))
          ) : (
             <div className="p-4 text-textGray text-center">No users found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Search;