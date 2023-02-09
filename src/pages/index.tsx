import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";

function App() {
  const [XML, setXML] = useState("");

  async function get_xml() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setXML(await invoke("get_xml", {url:"http://localhost:8088/api"}));
  }

  return (
    <div className="container">
      <h1>Welcome to vMix Utility!</h1>

      <div className="row">
        <div>
          <input
            id="greet-input"
            onChange={(e) => console.log(e)}
            placeholder="Enter a name..."
          />
          <button type="button" onClick={() => get_xml()}>
          Get XML
          </button>
        </div>
      </div>

      <p>{XML}</p>
    </div>
  );
}

export default App;
