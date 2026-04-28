import { useState } from 'react';
import ApplicationsList from '../components/Applications/ApplicationsList';

function Dashboard() {
  const [currentView, setCurrentView] = useState('list'); // 'list' or 'grid'
  const [currentTab, setCurrentTab] = useState('new');

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  return (
    <div>
          {currentView === 'list' ? (
            <ApplicationsList
              onViewChange={handleViewChange}
              currentView={currentView}
              currentTab={currentTab}
              onTabChange={setCurrentTab}
            />
          ) : (
            <ApplicationsGrid
              onViewChange={handleViewChange}
              currentView={currentView}
              currentTab={currentTab}
              onTabChange={setCurrentTab}
            />
          )}
        </div>
  );
}

export default Dashboard;