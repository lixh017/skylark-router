import { useState } from "react";
import Layout from "./components/Layout";
import ProviderList from "./components/ProviderList";
import ModelList from "./components/ModelList";
import Chat from "./components/Chat";
import UsageStats from "./components/UsageStats";
import APIKeyList from "./components/APIKeyList";
import RequestLogs from "./components/RequestLogs";
import DocsPage from "./components/DocsPage";
import SettingsPage from "./components/SettingsPage";
import SetupWizard from "./components/SetupWizard";

function App() {
  const [showWizard, setShowWizard] = useState(() => !localStorage.getItem("wizard_done"));

  if (showWizard) {
    return <SetupWizard onComplete={() => setShowWizard(false)} />;
  }

  return (
    <Layout>
      {{
        Providers: <ProviderList />,
        Models: <ModelList />,
        "API Keys": <APIKeyList />,
        Chat: <Chat />,
        Usage: <UsageStats />,
        Logs: <RequestLogs />,
        Docs: <DocsPage />,
        Settings: <SettingsPage />,
      }}
    </Layout>
  );
}

export default App;
