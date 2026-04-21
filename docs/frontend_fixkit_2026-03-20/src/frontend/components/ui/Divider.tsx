"use client";

import React from "react";

export const Divider: React.FC = () => {
  return (
    <div
      className="w-0 h-6 origin-left rotate-180 outline outline-1 outline-offset-[-0.50px] outline-gray-600"
      aria-hidden="true"
    />
  );
};

export default Divider;
