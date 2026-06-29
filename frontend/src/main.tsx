import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import CommentScraper from "./CommentScraper";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CommentScraper />
  </StrictMode>
);
