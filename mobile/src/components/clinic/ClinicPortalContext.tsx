// Which clinic a signed-in clinic member is working in. Members of several
// clinics can switch from the clinic top bar. Also holds the unread
// notification count shown on the top bar bell.
import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Membership } from '../../services/clinicPortal';
import { fetchUnreadCount } from '../../services/notifications';

type ClinicPortalValue = {
  memberships: Membership[];
  membership: Membership | undefined;
  selectClinic: (clinicId: number) => void;
  unreadCount: number;
  refreshUnread: () => void;
  setUnreadCount: (count: number) => void;
};

const ClinicPortalContext = createContext<ClinicPortalValue>({
  memberships: [],
  membership: undefined,
  selectClinic: () => undefined,
  unreadCount: 0,
  refreshUnread: () => undefined,
  setUnreadCount: () => undefined,
});

export function ClinicPortalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const memberships = useMemo(() => (user?.memberships as Membership[] | undefined) ?? [], [user?.memberships]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // The badge is a hint: a failed check (offline) keeps the last count.
  const refreshUnread = useCallback(() => {
    fetchUnreadCount().then(setUnreadCount).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({
      memberships,
      membership: memberships.find((m) => m.clinic_id === selectedId) ?? memberships[0],
      selectClinic: setSelectedId,
      unreadCount,
      refreshUnread,
      setUnreadCount,
    }),
    [memberships, selectedId, unreadCount, refreshUnread],
  );

  return <ClinicPortalContext.Provider value={value}>{children}</ClinicPortalContext.Provider>;
}

export const useClinicPortal = () => useContext(ClinicPortalContext);
