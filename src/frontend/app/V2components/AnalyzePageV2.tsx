import LayoutHost from "./components/LayoutHost";
import { MenuBar } from "./components/MenuBar";
import PanelManager from "./components/PanelManager";
import { Toolbar } from "./components/ToolBar";

export default function Main() {
  return (
    <div
      className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100"
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <MenuBar />

      <LayoutHost />
    </div>
  );
}
