import { useState, useEffect, useMemo } from 'react';
import { useVMixStatus } from './useVMixStatus';

export const useConnectionSelection = () => {
  const { connections } = useVMixStatus();
  const [selectedConnection, setSelectedConnection] = useState<string>('');

  const connectedConnections = useMemo(
    () => connections.filter(conn => conn.status === 'Connected'),
    [connections]
  );

  const effectiveSelectedConnection = useMemo(() => {
    if (
      selectedConnection &&
      connectedConnections.some(conn => conn.host === selectedConnection)
    ) {
      return selectedConnection;
    }
    return connectedConnections[0]?.host ?? '';
  }, [selectedConnection, connectedConnections]);

  useEffect(() => {
    if (connectedConnections.length === 0) {
      if (selectedConnection !== '') {
        setSelectedConnection('');
      }
      return;
    }

    if (
      selectedConnection &&
      !connectedConnections.some(conn => conn.host === selectedConnection)
    ) {
      setSelectedConnection(connectedConnections[0].host);
    }
  }, [connectedConnections, selectedConnection]);

  return {
    selectedConnection: effectiveSelectedConnection,
    setSelectedConnection,
    connectedConnections,
  };
};
