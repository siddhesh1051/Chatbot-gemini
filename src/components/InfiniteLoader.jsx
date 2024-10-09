import React from "react";

export default function InfiniteLoader() {
  return (
    <div className="w-full flex justify-center items-center">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <style>
          {`
          .spinner_0XTQ {
            transform-origin: center;
            animation: spinner_y6GP .75s linear infinite;
            }
            @keyframes spinner_y6GP {
                100% {
                    transform: rotate(360deg);
                    }
          }
          `}
        </style>
        <path
          className="spinner_0XTQ"
          d="M12,23a9.63,9.63,0,0,1-8-9.5,9.51,9.51,0,0,1,6.79-9.1A1.66,1.66,0,0,0,12,2.81h0a1.67,1.67,0,0,0-1.94-1.64A11,11,0,0,0,12,23Z"
        />
      </svg>
    </div>
  );
}
