/**
 * Connection Status Component
 * 
 * Shows real-time connection status to the backend server.
 * Displays healthy/degraded/offline states with visual indicators.
 */

import React, { useState, useEffect } from 'react';
import { checkHealth, type HealthStatus } from '../utils/resilientApi';

interface ConnectionStatusProps {
    className?: string;
    showDetails?: boolean;
    pollingInterval?: number;  // in ms, 0 to disable
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
    className = '',
    showDetails = false,
    pollingInterval = 30000,  // 30 seconds default
}) => {
    const [status, setStatus] = useState<HealthStatus>({
        online: true,
        status: 'healthy',
    });
    const [isChecking, setIsChecking] = useState(false);

    const checkServerHealth = async () => {
        setIsChecking(true);
        try {
            const healthStatus = await checkHealth();
            setStatus(healthStatus);
        } catch {
            setStatus({ online: false, status: 'offline' });
        } finally {
            setIsChecking(false);
        }
    };

    useEffect(() => {
        // Initial check
        checkServerHealth();

        // Set up polling if enabled
        if (pollingInterval > 0) {
            const interval = setInterval(checkServerHealth, pollingInterval);
            return () => clearInterval(interval);
        }
    }, [pollingInterval]);

    const statusLabel = {
        healthy: 'Connected',
        degraded: 'Degraded',
        offline: 'Offline',
    };

    return (
        <div
            className={`connection-status connection-status--${status.status} ${className}`}
            title={`Server status: ${status.status}`}
        >
            <span className={`connection-status__dot ${isChecking ? 'animate-pulse' : ''}`} />
            <span className="connection-status__label">
                {statusLabel[status.status]}
            </span>

            {showDetails && status.services && (
                <div className="connection-status__details">
                    <span>DB: {status.services.database}</span>
                    {Object.entries(status.services.circuits || {}).map(([name, circuit]) => (
                        <span key={name}>
                            {name}: {circuit.state}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ConnectionStatus;
