import React from 'react';

const Icons = {
    Cpu: () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="15" x2="23" y2="15" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="15" x2="4" y2="15" /></svg>
};

export const EvaluationOverlay: React.FC = () => {
    return (
        <div className="pi-eval-overlay">
            <div className="pi-eval-content">
                <div className="pi-eval-icon">
                    <Icons.Cpu />
                </div>
                <h2 className="pi-eval-title">Processing Intel...</h2>
                <div className="pi-eval-progress">
                    <div className="pi-eval-bar" />
                </div>
            </div>
        </div>
    );
};
