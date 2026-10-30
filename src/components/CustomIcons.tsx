"use client";

import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Icons provided by the user in D:\PROJECTS\loom\icons
 */

// 1. home-page-svgrepo-com.svg
export function HomeIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M981.4 502.3c-9.1 0-18.3-2.9-26-8.9L539 171.7c-15.3-11.8-36.7-11.8-52 0L70.7 493.4c-18.6 14.4-45.4 10.9-59.7-7.7-14.4-18.6-11-45.4 7.7-59.7L435 104.3c46-35.5 110.2-35.5 156.1 0L1007.5 426c18.6 14.4 22 41.1 7.7 59.7-8.5 10.9-21.1 16.6-33.8 16.6z" fill="currentColor" />
      <path d="M810.4 981.3H215.7c-70.8 0-128.4-57.6-128.4-128.4V534.2c0-23.5 19.1-42.6 42.6-42.6s42.6 19.1 42.6 42.6v318.7c0 23.8 19.4 43.2 43.2 43.2h594.8c23.8 0 43.2-19.4 43.2-43.2V534.2c0-23.5 19.1-42.6 42.6-42.6s42.6 19.1 42.6 42.6v318.7c-0.1 70.8-57.7 128.4-128.5 128.4z" fill="#4F46E5" />
    </svg>
  );
}

// 2. library-svgrepo-com.svg
export function LibraryIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.6" d="M19.5617 7C19.7904 5.69523 18.7863 4.5 17.4617 4.5H6.53788C5.21323 4.5 4.20922 5.69523 4.43784 7M17.4999 4.5C17.5283 4.24092 17.5425 4.11135 17.5427 4.00435C17.545 2.98072 16.7739 2.12064 15.7561 2.01142C15.6497 2 15.5194 2 15.2588 2H8.74099C8.48035 2 8.35002 2 8.24362 2.01142C7.22584 2.12064 6.45481 2.98072 6.45704 4.00434C6.45727 4.11135 6.47146 4.2409 6.49983 4.5" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M15 18H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M2.38351 13.793C1.93748 10.6294 1.71447 9.04765 2.66232 8.02383C3.61017 7 5.29758 7 8.67239 7H15.3276C18.7024 7 20.3898 7 21.3377 8.02383C22.2855 9.04765 22.0625 10.6294 21.6165 13.793L21.1935 16.793C20.8437 19.2739 20.6689 20.5143 19.7717 21.2572C18.8745 22 17.5512 22 14.9046 22H9.09536C6.44881 22 5.12553 22 4.22834 21.2572C3.33115 20.5143 3.15626 19.2739 2.80648 16.793L2.38351 13.793Z" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}

// 3. video-camera-svgrepo-com.svg
export function VideoCameraIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M5 18H15C16.1046 18 17 17.1046 17 16V8.57143V8C17 6.89543 16.1046 6 15 6H5C3.89543 6 3 6.89543 3 8V16C3 17.1046 3.89543 18 5 18Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6.5" cy="9.5" r="0.75" fill="currentColor"/>
      <path d="M17 10L21 7V17L17 14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}

// 4. saved-svgrepo-com.svg
export function SavedIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M18.5 18.8637V8.07579C18.5 5.99472 17.0378 4.20351 15.0077 3.7977C13.022 3.40077 10.978 3.40077 8.99225 3.7977C6.96219 4.20351 5.5 5.99472 5.5 8.07579V18.8637C5.5 20.1258 6.8627 20.9113 7.94601 20.2737L10.9053 18.5317C11.5814 18.1337 12.4186 18.1337 13.0947 18.5317L16.054 20.2737C17.1373 20.9113 18.5 20.1258 18.5 18.8637Z" stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.5 18.8637C5.5 20.1258 6.8627 20.9113 7.94601 20.2737L10.9053 18.5317C11.5814 18.1337 12.4186 18.1337 13.0947 18.5317L16.054 20.2737C17.1373 20.9113 18.5 20.1258 18.5 18.8637V8.07579C18.5 5.99472 17.0378 4.20351 15.0077 3.7977C13.022 3.40077 10.978 3.40077 8.99225 3.7977" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// 5. settings-interface-icon-svgrepo-com.svg
export function SettingsIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="-0.35 0 82.7 82.7" className={className} xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(-1227.4 -253.1)">
        <path d="M1280.3,292.9a11.952,11.952,0,0,1-13.4,13.4,12.092,12.092,0,0,1-10.3-10.3,11.952,11.952,0,0,1,13.4-13.4A12.092,12.092,0,0,1,1280.3,292.9Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="4.5"/>
        <path d="M1303.5,287.8H1295a29.324,29.324,0,0,0-2.5-6.4l6-6s3-3.3,0-6.3l-4.6-4.6s-3-2.7-5.7,0l-6.2,6.2a24.753,24.753,0,0,0-5.5-2.4h.1v-8.8s-.2-4.4-4.4-4.4h-6.5s-4,.2-4,4v8.8a23.208,23.208,0,0,0-5.7,2.2l-6.2-6.2s-3.3-3-6.3,0l-4.6,4.6s-2.7,3,0,5.7l6.1,6.1a26.488,26.488,0,0,0-2.5,5.4h-8.7s-4.4.2-4.4,4.4v6.5s.2,4,4,4h8.4a24.337,24.337,0,0,0,2.5,6.5l-5.9,5.9s-3,3.3,0,6.3l4.6,4.6s3,2.7,5.7,0l5.9-5.9a29,29,0,0,0,6.5,2.8v8.6s.2,4.4,4.4,4.4h6.5s4-.2,4-4v-9h-.1a30.79,30.79,0,0,0,5.3-2.1l5.8,5.8s3.3,3,6.3,0l4.6-4.6s2.7-3,0-5.7l-5.9-5.9a25.8,25.8,0,0,0,2.5-5.6h8.5s4.4-.2,4.4-4.4v-6.5S1307.3,287.8,1303.5,287.8Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="4.5"/>
      </g>
    </svg>
  );
}

// 6. users-svgrepo-com.svg
export function UsersIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M10.1992 12C12.9606 12 15.1992 9.76142 15.1992 7C15.1992 4.23858 12.9606 2 10.1992 2C7.43779 2 5.19922 4.23858 5.19922 7C5.19922 9.76142 7.43779 12 10.1992 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 22C1.57038 20.0332 2.74795 18.2971 4.36438 17.0399C5.98081 15.7827 7.95335 15.0687 10 15C14.12 15 17.63 17.91 19 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17.8205 4.44006C18.5822 4.83059 19.1986 5.45518 19.579 6.22205C19.9594 6.98891 20.0838 7.85753 19.9338 8.70032C19.7838 9.5431 19.3674 10.3155 18.7458 10.9041C18.1243 11.4926 17.3302 11.8662 16.4805 11.97" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17.3203 14.5701C18.6543 14.91 19.8779 15.5883 20.8729 16.5396C21.868 17.4908 22.6007 18.6827 23.0003 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// 7. user-svgrepo-com.svg
export function UserIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="12" r="8" fill="#4F46E5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M42 44C42 34.0589 33.9411 26 24 26C14.0589 26 6 34.0589 6 44" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// 8. product-workspace-svgrepo-com.svg
export function WorkspaceIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.2,2.2a1.63,1.63,0,0,1,1.7,1.7V5a1.63,1.63,0,0,1-1.7,1.7H10.1A3.4,3.4,0,0,0,6.7,9.9v32a3.4,3.4,0,0,0,3.2,3.4h32a3.4,3.4,0,0,0,3.4-3.2V36.8A1.63,1.63,0,0,1,47,35.1h1.1a1.63,1.63,0,0,1,1.7,1.7V43A6.81,6.81,0,0,1,43,49.8H9A6.81,6.81,0,0,1,2.2,43V9A6.81,6.81,0,0,1,9,2.2Z" fillRule="evenodd"/>
      <path d="M40.4,25.4l3.1-3.1a1,1,0,0,0,0-1.5L31,8.2a1,1,0,0,0-1.5,0l-3.1,3.1a1,1,0,0,0,0,1.5L38.9,25.3A1,1,0,0,0,40.4,25.4Z"/>
      <path d="M47.4,18.3l1.5-1.5a1,1,0,0,0,0-1.5L36.5,2.7a1,1,0,0,0-1.5,0L33.5,4.2a1,1,0,0,0,0,1.5L46,18.3A1,1,0,0,0,47.4,18.3Z"/>
      <path d="M36.8,28.9h0c.6-.6.5-1.1.1-1.5L24.4,14.9a1,1,0,0,0-1.5,0l-.1.1a1,1,0,0,0,0,1.5L35.3,29A1,1,0,0,0,36.8,28.9Z"/>
      <path d="M32.4,33.3l.7-.7a1,1,0,0,0,0-1.5L20.7,18.5a1,1,0,0,0-1.5,0l-.7.7a1,1,0,0,0,0,1.5L31,33.2C31.3,33.8,31.9,33.8,32.4,33.3Z"/>
      <path d="M25.7,40.1,28.8,37a1,1,0,0,0,0-1.5L16.3,22.9a1,1,0,0,0-1.5,0L11.7,26a1,1,0,0,0,0,1.5L24.2,40A1,1,0,0,0,25.7,40.1Z"/>
    </svg>
  );
}

// 9. notification-3-svgrepo-com.svg
export function NotificationIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M9.00903 17.9034L9.09282 17.1581L8.19549 17.0573L8.26101 17.9579L9.00903 17.9034ZM14.9908 17.9034L15.7389 17.9579L15.8044 17.0573L14.907 17.1581L14.9908 17.9034ZM14.9001 18.4773L15.6284 18.6563V18.6563L14.9001 18.4773ZM14.8181 18.8106L14.0898 18.6315L14.0898 18.6315L14.8181 18.8106ZM12.7038 20.917L12.8783 21.6464H12.8783L12.7038 20.917ZM11.2961 20.917L11.1216 21.6464H11.1216L11.2961 20.917ZM9.18175 18.8106L9.91006 18.6315L9.91006 18.6315L9.18175 18.8106ZM9.09978 18.4773L8.37148 18.6563L8.37148 18.6563L9.09978 18.4773ZM8.92524 18.6487C10.9686 18.8785 13.0312 18.8785 15.0746 18.6487L14.907 17.1581C12.975 17.3753 11.0248 17.3753 9.09282 17.1581L8.92524 18.6487ZM15.6284 18.6563C15.6848 18.4269 15.7217 18.1932 15.7389 17.9579L14.2428 17.849C14.2318 18.0004 14.208 18.1506 14.1718 18.2982L15.6284 18.6563ZM15.5464 18.9897L15.6284 18.6563L14.1718 18.2982L14.0898 18.6315L15.5464 18.9897ZM12.8783 21.6464C14.1944 21.3316 15.2229 20.3053 15.5464 18.9897L14.0898 18.6315C13.8997 19.4047 13.2964 20.0041 12.5293 20.1876L12.8783 21.6464ZM11.1216 21.6464C11.6991 21.7846 12.3008 21.7846 12.8783 21.6464L12.5293 20.1876C12.1812 20.2709 11.8186 20.2709 11.4705 20.1876L11.1216 21.6464ZM8.45345 18.9897C8.77694 20.3053 9.80543 21.3316 11.1216 21.6464L11.4705 20.1876C10.7034 20.0041 10.1002 19.4047 9.91006 18.6315L8.45345 18.9897ZM8.37148 18.6563L8.45345 18.9897L9.91006 18.6315L9.82809 18.2982L8.37148 18.6563ZM8.26101 17.9579C8.27813 18.1932 8.31506 18.4269 8.37148 18.6563L9.82809 18.2982C9.79181 18.1506 9.76807 18.0004 9.75706 17.849L8.26101 17.9579Z" fill="#4F46E5"/>
      <path d="M12.75 3C12.75 2.58579 12.4142 2.25 12 2.25C11.5858 2.25 11.25 2.58579 11.25 3H12.75ZM11.25 4.00474C11.25 4.41895 11.5858 4.75474 12 4.75474C12.4142 4.75474 12.75 4.41895 12.75 4.00474H11.25ZM11.25 3V4.00474H12.75V3H11.25Z" fill="#4F46E5"/>
      <path d="M6.0278 8.63262L6.7517 8.82876L6.7517 8.82876L6.0278 8.63262ZM10.1584 4.30225L9.92711 3.5888V3.5888L10.1584 4.30225ZM5.98297 8.79807L5.25907 8.60193L5.25907 8.60193L5.98297 8.79807ZM5.78956 12.8675L6.5288 12.7409V12.7409L5.78956 12.8675ZM5.81207 12.9989L5.07282 13.1255L5.07282 13.1255L5.81207 12.9989ZM6.28759 17.4572L6.43731 16.7223L6.43731 16.7223L6.28759 17.4572ZM6.65518 17.5321L6.50547 18.267L6.50547 18.267L6.65518 17.5321ZM17.3448 17.5321L17.4945 18.267V18.267L17.3448 17.5321ZM17.7124 17.4572L17.5627 16.7223L17.5627 16.7223L17.7124 17.4572ZM18.1922 12.9737L18.9315 13.1003V13.1003L18.1922 12.9737ZM18.2161 12.8343L17.4769 12.7077V12.7077L18.2161 12.8343ZM18.0417 8.82627L17.3163 9.0166V9.0166L18.0417 8.82627ZM17.9793 8.58838L18.7047 8.39805V8.39805L17.9793 8.58838ZM13.9671 4.3084L14.2023 3.59624V3.59624L13.9671 4.3084ZM18.353 13.3008L17.9868 13.9553L18.353 13.3008ZM5.66797 13.2892L6.02714 13.9476L5.66797 13.2892ZM6.7517 8.82876C7.23925 7.02934 8.62052 5.58918 10.3896 5.01571L9.92711 3.5888C7.67951 4.31737 5.92499 6.14419 5.3039 8.43648L6.7517 8.82876ZM6.70687 8.99421L6.7517 8.82876L5.3039 8.43648L5.25907 8.60193L6.70687 8.99421ZM6.5288 12.7409C6.3153 11.4939 6.37608 10.215 6.70687 8.99421L5.25907 8.60193C4.87128 10.0332 4.80004 11.5323 5.05032 12.994L6.5288 12.7409ZM6.55131 12.8723L6.5288 12.7409L5.05032 12.994L5.07282 13.1255L6.55131 12.8723ZM5.25 15.2604C5.25 14.6932 5.56385 14.2004 6.02714 13.9476L5.3088 12.6308C4.38074 13.1371 3.75 14.1251 3.75 15.2604H5.25ZM6.43731 16.7223C5.74893 16.5821 5.25 15.9725 5.25 15.2604H3.75C3.75 16.6808 4.74616 17.9086 6.13787 18.1921L6.43731 16.7223ZM6.8049 16.7972L6.43731 16.7223L6.13787 18.1921L6.50547 18.267L6.8049 16.7972ZM17.1951 16.7972C13.7666 17.4956 10.2334 17.4956 6.8049 16.7972L6.50547 18.267C10.1316 19.0057 13.8684 19.0057 17.4945 18.267L17.1951 16.7972ZM17.5627 16.7223L17.1951 16.7972L17.4945 18.267L17.8621 18.1921L17.5627 16.7223ZM18.75 15.2604C18.75 15.9725 18.2511 16.5821 17.5627 16.7223L17.8621 18.1921C19.2538 17.9086 20.25 16.6808 20.25 15.2604H18.75ZM17.9868 13.9553C18.4425 14.2103 18.75 14.6989 18.75 15.2604H20.25C20.25 14.1365 19.6319 13.157 18.7192 12.6463L17.9868 13.9553ZM17.4769 12.7077L17.453 12.8471L18.9315 13.1003L18.9554 12.9609L17.4769 12.7077ZM17.3163 9.0166C17.6323 10.2212 17.6871 11.48 17.4769 12.7077L18.9554 12.9609C19.2017 11.5223 19.1375 10.0474 18.7672 8.63594L17.3163 9.0166ZM17.2539 8.77871L17.3163 9.0166L18.7672 8.63594L18.7047 8.39805L17.2539 8.77871ZM13.7319 5.02057C15.4622 5.59203 16.7887 7.00577 17.2539 8.77871L18.7047 8.39805C18.1113 6.13597 16.4174 4.32782 14.2023 3.59624L13.7319 5.02057ZM10.3896 5.01571C11.474 4.66421 12.6528 4.6642 13.7319 5.02057L14.2023 3.59624C12.8171 3.13875 11.3114 3.14007 9.92711 3.5888L10.3896 5.01571ZM18.7192 12.6463C18.8626 12.7265 18.966 12.8988 18.9315 13.1003L17.453 12.8471C17.3735 13.3114 17.6116 13.7453 17.9868 13.9553L18.7192 12.6463ZM5.07282 13.1255C5.03579 12.9092 5.14712 12.719 5.3088 12.6308L6.02714 13.9476C6.39669 13.746 6.62845 13.3229 6.55131 12.8723L5.07282 13.1255Z" fill="currentColor"/>
    </svg>
  );
}

// 10. chat-interface-icon-svgrepo-com.svg
export function ChatIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 -10.79 107 107" className={className} xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(-1020.5 -250.9)">
        <path d="M1113,252.9h-78a12.5,12.5,0,0,0-12.5,12.5v65.7s0,3.4,2.7,3.2c1.7,0,15.2-8.5,19.3-11.2H1113a12.5,12.5,0,0,0,12.5-12.5V265.4A12.5,12.5,0,0,0,1113,252.9Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="5"/>
        <line x2="21" transform="translate(1047.1 280.3)" fill="none" stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="5"/>
        <line x2="45.5" transform="translate(1047.1 298.4)" fill="none" stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="5"/>
      </g>
    </svg>
  );
}

// 11. calendar-icon (with Sunset Orange #4F46E5 accent)
export function CalendarIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="17" rx="3.5" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M16 2V6" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 2V6" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round"/>
      <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="8" cy="13.5" r="1.2" fill="#4F46E5"/>
      <circle cx="12" cy="13.5" r="1.2" fill="#4F46E5"/>
      <circle cx="16" cy="13.5" r="1.2" fill="#4F46E5"/>
      <circle cx="8" cy="17" r="1.2" fill="#4F46E5"/>
      <circle cx="12" cy="17" r="1.2" fill="#4F46E5"/>
      <circle cx="16" cy="17" r="1.2" fill="#4F46E5"/>
    </svg>
  );
}

// 12. credit-card-billing-icon
export function BillingIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="1.8" />
      <rect x="6" y="14" width="4" height="2" rx="0.5" fill="#4F46E5" />
      <circle cx="17" cy="15" r="1" fill="#06B6D4" />
    </svg>
  );
}

