import { useState, useEffect, useMemo } from 'react';
import { useVMixStatus } from './useVMixStatus';

export const useConnectionSelection = () => {
  const { connections } = useVMixStatus();
  const [selectedConnection, setSelectedConnection] = useState<string>('');

  // Memoize connected connections to avoid recalculation
  const connectedConnections = useMemo(() => 
    connections.filter(conn => conn.status === 'Connected'), 
    [connections]
  );

  // Simplified auto-selection logic with minimal useEffect
  useEffect(() => {
    if (connectedConnections.length > 0 && !selectedConnection) {
      setSelectedConnection(connectedConnections[0].host);
    } else if (connectedConnections.length === 0) {
      setSelectedConnection('');
    } else if (selectedConnection && !connectedConnections.find(conn => conn.host === selectedConnection)) {
      // If current selection is no longer connected, switch to first available
      if (connectedConnections.length > 0) {
        setSelectedConnection(connectedConnections[0].host);
      }
    }
  }, [connectedConnections, selectedConnection]);

  return {
    selectedConnection,
    setSelectedConnection,
    connectedConnections
  };
};