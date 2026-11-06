
import React, { createContext, useContext, useState } from 'react';

interface ScheduleData {
  clientName: string;
  phoneNumber: string;
  selectedDate: Date | undefined;
  selectedTime: string;
  selectedService: string;
}

interface ScheduleContextType {
  scheduleData: ScheduleData;
  setClientName: (name: string) => void;
  setPhoneNumber: (phone: string) => void;
  setSelectedDate: (date: Date | undefined) => void;
  setSelectedTime: (time: string) => void;
  setSelectedService: (service: string) => void;
  slotsVersion: number;
  bumpSlots: () => void;
  reset: () => void;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export const ScheduleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    clientName: '',
    phoneNumber: '',
    selectedDate: undefined,
    selectedTime: '',
    selectedService: '',
  });

  const setClientName = (name: string) => {
    setScheduleData(prev => ({ ...prev, clientName: name }));
  };

  const setPhoneNumber = (phone: string) => {
    setScheduleData(prev => ({ ...prev, phoneNumber: phone }));
  };

  const setSelectedDate = (date: Date | undefined) => {
    setScheduleData(prev => ({ ...prev, selectedDate: date, selectedTime: '' }));
  };

  const setSelectedTime = (time: string) => {
    setScheduleData(prev => ({ ...prev, selectedTime: time }));
  };

  const setSelectedService = (service: string) => {
    setScheduleData(prev => ({ ...prev, selectedService: service }));
  };

  const [slotsVersion, setSlotsVersion] = useState(0);
  const bumpSlots = () => setSlotsVersion(v => v + 1);
  const reset = () => { setScheduleData(prev => ({ ...prev, selectedTime: '' })); bumpSlots(); };

  return (
    <ScheduleContext.Provider value={{
      scheduleData,
      setClientName,
      setPhoneNumber,
      setSelectedDate,
      setSelectedTime,
      setSelectedService,
      slotsVersion,
      bumpSlots,
      reset,
    }}>
      {children}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
};
