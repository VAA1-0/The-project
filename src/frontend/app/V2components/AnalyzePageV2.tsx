import { MenuBar } from "./components/MenuBar";
import PanelManager from "./components/PanelManager";
import { Toolbar } from "./components/ToolBar";
import PanelManagerOld from "./components/PanelManagerOld";

export default function Main() {
  return (
    <div className="h-full w-full flex flex-col bg-gray-100">
      <MenuBar />
      <Toolbar />

      <PanelManagerOld />
    </div>
  );
}
