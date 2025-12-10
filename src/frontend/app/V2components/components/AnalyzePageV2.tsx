import { MenuBar } from "./MenuBar";
import PanelManager from "./PanelManager";
import { Toolbar } from "./ToolBar";

export default function Main() {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100"
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <MenuBar />
      <Toolbar />
      <PanelManager />
    </div>
  );
}
