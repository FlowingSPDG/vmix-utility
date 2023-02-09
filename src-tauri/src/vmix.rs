// Example code that deserializes and serializes the model.
// extern crate serde;
// #[macro_use]
// extern crate serde_derive;
// extern crate serde_json;
//
// use generated_module::[object Object];
//
// fn main() {
//     let json = r#"{"answer": 42}"#;
//     let model: [object Object] = serde_json::from_str(&json).unwrap();
// }

use serde::{Serialize, Deserialize};

pub fn parse_vmix_api(raw: &str) -> Option<VMixRoot> {
    let vm:VMixRoot  = serde_json::from_str(raw).unwrap();
    Some(vm)
}


#[derive(Serialize, Deserialize, Debug)]
pub struct VMixRoot {
    #[serde(rename = "vmix")]
    vmix: Vmix,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Vmix {
    #[serde(rename = "version")]
    version: String,

    #[serde(rename = "edition")]
    edition: String,

    #[serde(rename = "preset")]
    preset: String,

    #[serde(rename = "inputs")]
    inputs: Inputs,

    #[serde(rename = "overlays")]
    overlays: Overlays,

    #[serde(rename = "preview")]
    preview: String,

    #[serde(rename = "active")]
    active: String,

    #[serde(rename = "fadeToBlack")]
    fade_to_black: External,

    #[serde(rename = "transitions")]
    transitions: Transitions,

    #[serde(rename = "recording")]
    recording: External,

    #[serde(rename = "external")]
    external: External,

    #[serde(rename = "streaming")]
    streaming: External,

    #[serde(rename = "playList")]
    play_list: External,

    #[serde(rename = "multiCorder")]
    multi_corder: External,

    #[serde(rename = "fullscreen")]
    fullscreen: External,

    #[serde(rename = "audio")]
    audio: Audio,

    #[serde(rename = "dynamic")]
    dynamic: Dynamic,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Audio {
    #[serde(rename = "master")]
    master: Master,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Master {
    #[serde(rename = "_volume")]
    volume: String,

    #[serde(rename = "_muted")]
    muted: External,

    #[serde(rename = "_meterF1")]
    meter_f1: String,

    #[serde(rename = "_meterF2")]
    meter_f2: String,

    #[serde(rename = "_headphonesVolume")]
    headphones_volume: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Dynamic {
    #[serde(rename = "input1")]
    input1: String,

    #[serde(rename = "input2")]
    input2: String,

    #[serde(rename = "input3")]
    input3: String,

    #[serde(rename = "input4")]
    input4: String,

    #[serde(rename = "value1")]
    value1: String,

    #[serde(rename = "value2")]
    value2: String,

    #[serde(rename = "value3")]
    value3: String,

    #[serde(rename = "value4")]
    value4: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Inputs {
    #[serde(rename = "input")]
    input: Vec<Input>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Input {
    #[serde(rename = "overlay")]
    overlay: Option<OverlayUnion>,

    #[serde(rename = "_key")]
    key: String,

    #[serde(rename = "_number")]
    number: String,

    #[serde(rename = "_type")]
    input_type: Type,

    #[serde(rename = "_title")]
    title: String,

    #[serde(rename = "_shortTitle")]
    short_title: String,

    #[serde(rename = "_state")]
    state: State,

    #[serde(rename = "_position")]
    position: String,

    #[serde(rename = "_duration")]
    duration: String,

    #[serde(rename = "_loop")]
    input_loop: External,

    #[serde(rename = "__text")]
    text: String,

    #[serde(rename = "text")]
    input_text: Option<Vec<Text>>,

    #[serde(rename = "_selectedIndex")]
    selected_index: Option<String>,

    #[serde(rename = "_muted")]
    muted: Option<External>,

    #[serde(rename = "_volume")]
    volume: Option<String>,

    #[serde(rename = "_balance")]
    balance: Option<String>,

    #[serde(rename = "_solo")]
    solo: Option<External>,

    #[serde(rename = "_audiobusses")]
    audiobusses: Option<Audiobusses>,

    #[serde(rename = "_meterF1")]
    meter_f1: Option<String>,

    #[serde(rename = "_meterF2")]
    meter_f2: Option<String>,

    #[serde(rename = "_gainDb")]
    gain_db: Option<String>,

    #[serde(rename = "position")]
    input_position: Option<InputPosition>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct InputPosition {
    #[serde(rename = "_zoomX")]
    zoom_x: String,

    #[serde(rename = "_zoomY")]
    zoom_y: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Text {
    #[serde(rename = "_index")]
    index: String,

    #[serde(rename = "_name")]
    name: String,

    #[serde(rename = "__text")]
    text: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PurpleOverlay {
    #[serde(rename = "_index")]
    index: String,

    #[serde(rename = "_key")]
    key: String,

    #[serde(rename = "position")]
    position: Option<OverlayPosition>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct OverlayPosition {
    #[serde(rename = "_panX")]
    pan_x: Option<String>,

    #[serde(rename = "_panY")]
    pan_y: Option<String>,

    #[serde(rename = "_zoomX")]
    zoom_x: Option<String>,

    #[serde(rename = "_zoomY")]
    zoom_y: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FluffyOverlay {
    #[serde(rename = "_index")]
    index: String,

    #[serde(rename = "_key")]
    key: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Overlays {
    #[serde(rename = "overlay")]
    overlay: Vec<OverlaysOverlay>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct OverlaysOverlay {
    #[serde(rename = "_number")]
    number: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Transitions {
    #[serde(rename = "transition")]
    transition: Vec<Transition>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Transition {
    #[serde(rename = "_number")]
    number: String,

    #[serde(rename = "_effect")]
    effect: String,

    #[serde(rename = "_duration")]
    duration: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(untagged)]
pub enum OverlayUnion {
    FluffyOverlay(FluffyOverlay),

    PurpleOverlayArray(Vec<PurpleOverlay>),
}

#[derive(Serialize, Deserialize, Debug)]
pub enum External {
    #[serde(rename = "False")]
    False,

    #[serde(rename = "True")]
    True,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Audiobusses {
    #[serde(rename = "M")]
    M,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Type {
    #[serde(rename = "Capture")]
    Capture,

    #[serde(rename = "Colour")]
    Colour,

    #[serde(rename = "Image")]
    Image,

    #[serde(rename = "NDI")]
    Ndi,

    #[serde(rename = "Output")]
    Output,

    #[serde(rename = "Preview")]
    Preview,

    #[serde(rename = "ProductionClocks")]
    ProductionClocks,

    #[serde(rename = "Video")]
    Video,

    #[serde(rename = "VirtualSet")]
    VirtualSet,

    #[serde(rename = "Xaml")]
    Xaml,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum State {
    #[serde(rename = "Paused")]
    Paused,

    #[serde(rename = "Running")]
    Running,
}
