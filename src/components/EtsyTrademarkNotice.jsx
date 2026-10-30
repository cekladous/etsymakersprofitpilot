import React from "react";

// Required Etsy trademark attribution. Wording is prescribed by Etsy and must
// not be altered.
export default function EtsyTrademarkNotice({ className = "" }) {
  return (
    <p className={`text-xs leading-relaxed ${className}`}>
      The term 'Etsy' is a trademark of Etsy, Inc. This application uses the Etsy API but is not
      endorsed or certified by Etsy, Inc.
    </p>
  );
}