import React from "react";
import { FiClock } from "react-icons/fi";

/* Generic "Coming soon" placeholder used for all unbuilt tabs */
const ComingSoonTab = ({ tabLabel = "This section" }) => (
  <div className="adp-empty-state">
    <FiClock size={40} />
    <p>
      <strong>{tabLabel}</strong> is under construction.
    </p>
    <span className="adp-empty-sub">Check back soon.</span>
  </div>
);

export default ComingSoonTab;
