import { Chakra_Petch } from "next/font/google";

// The booking app's label face (its queue-number label and bike-type badges). Loaded only by the
// pages that show its cards, so every other page skips the download.
export const labelFont = Chakra_Petch({ subsets: ["latin"], weight: ["600", "700"], display: "swap", variable: "--tk-font-label" });
