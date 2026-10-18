"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import RecordingSetupModal from "@/components/RecordingSetupModal";

interface RecordingContextType {
  isRecordModalOpen: boolean;
  openRecordModal: () => void;
  closeRecordModal: () => void;
}

const RecordingContext = createContext<RecordingContextType>({
  isRecordModalOpen: false,
  openRecordModal: () => {},
  closeRecordModal: () => {},
});

export function useGlobalRecording() {
  return useContext(RecordingContext);
}

/**
 * Universal helper to open recording modal from anywhere in the app
 * without needing React hook hierarchy.
 */
export function openGlobalRecording() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rcrd_open_record_modal"));
  }
}

export function closeGlobalRecording() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rcrd_close_record_modal"));
  }
}

export default function GlobalRecordingManager({ children }: { children: React.ReactNode }) {
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  const openRecordModal = useCallback(() => setIsRecordModalOpen(true), []);
  const closeRecordModal = useCallback(() => setIsRecordModalOpen(false), []);

  useEffect(() => {
    const handleOpen = () => setIsRecordModalOpen(true);
    const handleClose = () => setIsRecordModalOpen(false);

    window.addEventListener("rcrd_open_record_modal", handleOpen);
    window.addEventListener("rcrd_close_record_modal", handleClose);

    return () => {
      window.removeEventListener("rcrd_open_record_modal", handleOpen);
      window.removeEventListener("rcrd_close_record_modal", handleClose);
    };
  }, []);

  return (
    <RecordingContext.Provider value={{ isRecordModalOpen, openRecordModal, closeRecordModal }}>
      {children}
      {/* Persisted at root layout so route transitions across sidebar sections never unmount the recorder! */}
      <RecordingSetupModal
        isOpen={isRecordModalOpen}
        onClose={closeRecordModal}
      />
    </RecordingContext.Provider>
  );
}
