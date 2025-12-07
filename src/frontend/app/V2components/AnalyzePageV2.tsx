import { MenuBar } from "./components/MenuBar";
import PanelManager from "./components/PanelManager";
import { Toolbar } from "./components/ToolBar";

export default function Main() {
  return (
    <div className="h-screen w-screen flex flex-col bg-[#232323] overflow-hidden">
      <MenuBar />
      <Toolbar />

      <PanelManager />
    </div>
  );
}
