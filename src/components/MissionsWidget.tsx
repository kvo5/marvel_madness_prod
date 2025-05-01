"use client"; // Required for react-countdown

import React, { useState, useEffect } from "react";
import Countdown, { CountdownRenderProps } from "react-countdown";
import { useUser } from "@clerk/nextjs";

const MissionsWidget = () => {
  const { user, isLoaded } = useUser();
  const [points, setPoints] = useState<number>(0);
  const [lastHourlyClaim, setLastHourlyClaim] = useState<string | null>(null);
  const [lastDailyClaim, setLastDailyClaim] = useState<string | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isClaimingHourly, setIsClaimingHourly] = useState(false);
  const [isClaimingDaily, setIsClaimingDaily] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const HOURLY_COOLDOWN = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
  const DAILY_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  // Fetch mission status on mount or when user changes
  useEffect(() => {
    if (isLoaded && user) {
      const fetchStatus = async () => {
        setIsLoadingStatus(true);
        setError(null);
        try {
          const response = await fetch("/api/users/me/mission-status");
          if (!response.ok) {
            throw new Error(`Failed to fetch mission status: ${response.statusText}`);
          }
          const data = await response.json();
          setPoints(data.points ?? 0);
          // Adjust field names if backend uses different ones (e.g., lastHourlyClaim vs lastDailyClaim)
          setLastHourlyClaim(data.lastHourlyClaim ?? null); // Assuming backend uses lastHourlyClaim for 1h
          setLastDailyClaim(data.lastDailyClaim ?? null);   // Assuming backend uses lastDailyClaim for 7d
        } catch (err) {
          console.error("Error fetching mission status:", err);
          const message = err instanceof Error ? err.message : "Failed to load mission status.";
          setError(message);
          setPoints(0);
          setLastHourlyClaim(null);
          setLastDailyClaim(null);
        } finally {
          setIsLoadingStatus(false);
        }
      };
      fetchStatus();
    } else if (isLoaded && !user) {
      // Not logged in
      setPoints(0);
      setLastHourlyClaim(null);
      setLastDailyClaim(null);
      setIsLoadingStatus(false);
    }
  }, [isLoaded, user]);

  // Calculate cooldown end times and eligibility
  const now = Date.now();
  const hourlyCooldownEndTime = lastHourlyClaim ? new Date(lastHourlyClaim).getTime() + HOURLY_COOLDOWN : 0;
  const dailyCooldownEndTime = lastDailyClaim ? new Date(lastDailyClaim).getTime() + DAILY_COOLDOWN : 0;

  const isHourlyClaimable = now >= hourlyCooldownEndTime;
  const isDailyClaimable = now >= dailyCooldownEndTime;

  // Claim Handlers
  const handleClaim = async (type: "hourly" | "daily") => {
    const endpoint = `/api/missions/claim/${type}`;
    const setIsClaiming = type === "hourly" ? setIsClaimingHourly : setIsClaimingDaily;
    const setLastError = type === "hourly" ? setLastHourlyClaim : setLastDailyClaim;

    setIsClaiming(true);
    setError(null);
    try {
      const response = await fetch(endpoint, { method: "POST" });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Failed to claim ${type} reward.` }));
        throw new Error(errorData.message || `Failed to claim ${type} reward.`);
      }
      const data = await response.json();
      setPoints(data.points);
      setLastError(data.lastClaim); // Assuming backend returns { points: number, lastClaim: string }
    } catch (err) {
      console.error(`Error claiming ${type} reward:`, err);
      const message = err instanceof Error ? err.message : `Failed to claim ${type} reward.`;
      setError(message);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClaimHourly = () => handleClaim("hourly");
  const handleClaimDaily = () => handleClaim("daily");

  // Countdown Renderer
  const countdownRenderer = ({ hours, minutes, seconds, completed }: CountdownRenderProps) => {
    if (completed) {
      // This part might not be reached if we re-render based on eligibility state change,
      // but good to handle just in case.
      return <span>CLAIM NOW!</span>;
    } else {
      return (
        <span>
          {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
          {String(seconds).padStart(2, "0")}
        </span>
      );
    }
  };


  return (
    <div className="p-4 rounded-2xl border-[1px] border-borderYellow flex flex-col gap-4">
      <h1 className="text-xl font-bold text-textGrayLight text-center mb-2">
        Missions
      </h1>

      {error && <p className="text-red-500 text-center text-sm">{error}</p>}

      <div className="flex flex-col gap-3 items-center">
        {/* Hourly Button */}
        <button
          className="bg-[#ffe046] text-black font-semibold py-2 px-4 rounded-lg w-full disabled:opacity-70 disabled:cursor-not-allowed"
          onClick={handleClaimHourly}
          disabled={isLoadingStatus || isClaimingHourly || !isHourlyClaimable}
        >
          {isLoadingStatus ? "Loading..." :
           isClaimingHourly ? "Claiming..." :
           isHourlyClaimable ? "CLAIM HOURLY (+10)" : (
            <Countdown date={hourlyCooldownEndTime} renderer={countdownRenderer} />
          )}
        </button>

        {/* Daily Button */}
        <button
          className="bg-[#ffe046] text-black font-semibold py-2 px-4 rounded-lg w-full disabled:opacity-70 disabled:cursor-not-allowed"
          onClick={handleClaimDaily}
          disabled={isLoadingStatus || isClaimingDaily || !isDailyClaimable}
        >
           {isLoadingStatus ? "Loading..." :
            isClaimingDaily ? "Claiming..." :
            isDailyClaimable ? "CLAIM DAILY (+50)" : (
            <Countdown date={dailyCooldownEndTime} renderer={countdownRenderer} />
          )}
        </button>
      </div>

      <p className="text-textGray text-center mt-4">
        Current Points: {isLoadingStatus ? "[Loading...]" : points ?? 0}
      </p>
    </div>
  );
};

export default MissionsWidget;