"use client"; // Required for react-countdown

import React, { useState, useEffect } from "react";
import Countdown, { CountdownRenderProps } from "react-countdown";
import { useUser } from "@clerk/nextjs";

interface MissionStatus {
  points: number;
  lastHourlyClaim: string | null;
  lastDailyClaim: string | null;
}

const MissionsWidget = () => {
  const { user, isLoaded } = useUser();
  // Step 2: Consolidate state
  const [missionStatus, setMissionStatus] = useState<MissionStatus>({
    points: 0,
    lastHourlyClaim: null,
    lastDailyClaim: null,
  });
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
          // Step 2: Populate consolidated state
          setMissionStatus({
            points: data.points ?? 0,
            lastHourlyClaim: data.lastHourlyClaim ?? null,
            lastDailyClaim: data.lastDailyClaim ?? null,
          });
        } catch (err) {
          console.error("Error fetching mission status:", err);
          const message = err instanceof Error ? err.message : "Failed to load mission status.";
          setError(message);
          // Reset consolidated state on error
          setMissionStatus({ points: 0, lastHourlyClaim: null, lastDailyClaim: null });
        } finally {
          setIsLoadingStatus(false);
        }
      };
      fetchStatus();
    } else if (isLoaded && !user) {
      // Not logged in
      setMissionStatus({ points: 0, lastHourlyClaim: null, lastDailyClaim: null });
      setIsLoadingStatus(false);
    }
  }, [isLoaded, user]);

  // Step 4: Create Action Function
  const submitClaim = async (claimType: 'hourly' | 'daily') => {
    const setIsClaiming = claimType === 'hourly' ? setIsClaimingHourly : setIsClaimingDaily;

    setIsClaiming(true);
    setError(null);

    try {
      // Trigger the actual fetch call
      const response = await fetch(`/api/missions/claim/${claimType}`, { method: 'POST' });

      if (!response.ok) {
         const errorData = await response.json().catch(() => ({ message: `Failed to claim ${claimType} reward.` }));
         throw new Error(errorData.message || `Failed to claim ${claimType} reward.`);
      }

      // Success: Parse response, update state, and refresh
      const data = await response.json();
      setMissionStatus({
        points: data.points,
        lastHourlyClaim: data.lastHourlyClaim,
        lastDailyClaim: data.lastDailyClaim,
      });
      window.location.reload(); // Refresh the page on successful claim

    } catch (err) {
      console.error(`Error claiming ${claimType} reward:`, err);
      const message = err instanceof Error ? err.message : `Failed to claim ${claimType} reward.`;
      setError(message);
      // No automatic revert needed, state wasn't changed optimistically
    } finally {
      setIsClaiming(false); // Reset loading state regardless of success or failure
    }
  };


  // Step 6: Update Rendering Logic (using optimisticStatus)
  const now = Date.now();
  const hourlyCooldownEndTime = missionStatus.lastHourlyClaim ? new Date(missionStatus.lastHourlyClaim).getTime() + HOURLY_COOLDOWN : 0;
  const dailyCooldownEndTime = missionStatus.lastDailyClaim ? new Date(missionStatus.lastDailyClaim).getTime() + DAILY_COOLDOWN : 0;

  const isHourlyClaimable = now >= hourlyCooldownEndTime;
  const isDailyClaimable = now >= dailyCooldownEndTime;


  // Step 5: Update Click Handlers
  const handleClaimHourly = () => submitClaim("hourly");
  const handleClaimDaily = () => submitClaim("daily");

  // Countdown Renderer (no changes needed here)
  const countdownRenderer = ({ hours, minutes, seconds, completed }: CountdownRenderProps) => {
    if (completed) {
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
        {/* Hourly Button - Step 6: Update Rendering Logic */}
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

        {/* Daily Button - Step 6: Update Rendering Logic */}
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
        {/* Step 6: Update Rendering Logic */}
        Current Points: {isLoadingStatus ? "[Loading...]" : missionStatus.points ?? 0}
      </p>
    </div>
  );
};

export default MissionsWidget;

// Step 7: Cleanup - Old handleClaim function is removed implicitly by not including it.
// Old state setters (setPoints, etc.) are removed implicitly.