import { MediaStreamComposer, MouseTool, StreamDetails } from '@api.video/media-stream-composer'
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import StartRecordingIcon from '@mui/icons-material/FiberManualRecord'
import GestureIcon from '@mui/icons-material/Gesture'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import SettingsIcon from '@mui/icons-material/Settings'
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { Alert, Box, FormControl, FormGroup, FormLabel, Menu, MenuItem, Paper, Select, Snackbar, Step, StepContent, StepLabel, Stepper, ThemeProvider, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import Button from '@mui/material/Button'
import { createTheme } from '@mui/material/styles'
import PopupState from 'material-ui-popup-state'
import {
  bindMenu, bindTrigger
} from 'material-ui-popup-state/hooks'
import type { NextPage } from 'next'
import Head from 'next/head'
import NextImage from 'next/image'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { CirclePicker } from 'react-color'
import styles from '../../styles/Home.module.css'
import StreamDialog, { StreamFormValues } from '../components/StreamDialog'
import UploadSettingsDialog, { UploadSettings } from '../components/UploadSettingsDialog'
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';

const theme = createTheme({
  palette: {
    primary: {
      light: '#757ce8',
      main: '#FA5B30',
      dark: '#FF6B40',
      contrastText: '#fff',
    },
    secondary: {
      light: '#ff7961',
      main: '#f44336',
      dark: '#ba000d',
      contrastText: '#000',
    },

  },
});

const WIDTH = 1600;
const HEIGHT = 1000;
const DEFAULT_UPLOAD_TOKEN = process.env.NEXT_PUBLIC_UPLOAD_TOKEN!;

const composer = (() => {
  const mediaStreamComposer = new MediaStreamComposer({
    resolution: {
      width: WIDTH,
      height: HEIGHT
    },
  });
  
  mediaStreamComposer.addEventListener("recordingStopped", (e: any) => {
    if (e.data.file) {
      const a = document.createElement("a");
      console.log(e.data.file);
      let extension = "mp4";
      try {
        extension = (e.data.file.type.split("/")[1]).split(";")[0];
      } catch (e) {
        console.error(e);
      }
      a.href = URL.createObjectURL(e.data.file);
      a.download = `video.${extension}`;
      a.click();
    }
  });
  return mediaStreamComposer;
})();



const Home: NextPage = () => {
  const [addStreamDialogIsOpen, setAddStreamDialogOpen] = useState(false);
  const [uploadSettingsDialogIsOpen, setUploadSettingsDialogOpen] = useState(false);

  const [streams, setStreams] = useState<StreamDetails[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [mouseTool, setMouseTool] = useState<MouseTool>("move-resize");
  const [videoDevices, setVideoDevices] = useState<InputDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<InputDeviceInfo[]>([]);
  const [uploadToken, setUploadToken] = useState<string>(DEFAULT_UPLOAD_TOKEN);
  const [videoName, setVideoName] = useState<string>('')

  const [firstStreamAddedAlertOpen, setFirstStreamAddedAlertOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [audioSource, setAudioSource] = useState<string>("none");
  const [audioStreamId, setAudioStreamId] = useState<string | undefined>();
  const [uploadSettings, setUploadSettings] = useState<UploadSettings>({
    videoName: "Yumi's 4th Birthday Greeting!",
    downloadVideoFile: false,
  });
  const [videoStatus, setVideoStatus] = useState<"recording" | "encoding" | "playable" | undefined>();

  const router = useRouter()

  useEffect(() => {
    if (streams.length === 0 && document.querySelector("canvas")) {
      document.getElementById('canvas-container')!.removeChild(document.querySelector("canvas")!)
    }
  }, [streams])

  useEffect(() => {
    (window as any).composer = composer;
    if (router.query.uploadToken) {
      setUploadToken(router.query.uploadToken as string);
    }
  }, [router.query])

  // handle the record duration timer
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      const interval = setInterval(() => {
        setRecordingDuration(recordingDuration => recordingDuration + 1);
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [isRecording])

  // retrieve the list of webcam on init
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then((stream) => {
        navigator.mediaDevices.enumerateDevices()
          .then((devices) => {
            setVideoDevices(devices.filter(d => d.kind === "videoinput"));
            setAudioDevices(devices.filter(d => d.kind === "audioinput"));
            stream.getTracks().forEach(x => x.stop());
          })
      })
      .catch(e => console.log(e));
  }, []);

  function onDragEnd({ destination, source }: DropResult) {
    if (!destination || source.index === destination.index) return
    const streamId = composer.getStreams().at(source.index)?.id
    if (!streamId) return
    let newIndex = source.index
    if (source.index > destination.index) {
      do {
        composer.moveDown(streamId)
        newIndex--;
      } while (newIndex !== destination.index);
    } else {
      do {
        composer.moveUp(streamId)
        newIndex++;
      } while (newIndex !== destination.index);
    }

    const newStreams = Array.from(streams);
    const [removed] = newStreams.splice(source.index, 1);
    newStreams.splice(destination.index, 0, removed);
    setStreams(newStreams);
  };

  async function addStream(opts: StreamFormValues) {
    setAddStreamDialogOpen(false);
    let stream: MediaStream | HTMLImageElement;
    switch (opts.type) {
      case "screen":
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        break;
      case "webcam":
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { deviceId: opts.deviceId } })
        break;
      case "image":
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = opts.imageUrl!;
        stream = image;
    }
    /*opts.type === "webcam"
      ? await navigator.mediaDevices.getUserMedia({ audio: true, video: { deviceId: opts.deviceId } })
      : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });*/

    setTimeout(() => {
      composer.addStream(stream, {
        position: opts.position,
        width: opts.width ? parseInt(opts.width, 10) * WIDTH / 100 : undefined,
        height: opts.height ? parseInt(opts.height, 10) * HEIGHT / 100 : undefined,
        x: opts.left ? parseInt(opts.left, 10) * WIDTH / 100 : undefined,
        y: opts.top ? parseInt(opts.top, 10) * HEIGHT / 100 : undefined,
        resizable: opts.resizable,
        draggable: opts.draggable,
        opacity: opts.opacity,
        mask: opts.mask,
        mute: true,
        name: `${opts.type}`,
      });
      composer.appendCanvasTo("#canvas-container");
      const canvas = composer.getCanvas();
      canvas!.style.width = "100%";
      canvas!.style.height = "100%";
      canvas!.style.boxSizing = "unset";
      setStreams([...streams, composer.getStreams()[composer.getStreams().length - 1]]);
    }, 100);
  }

  function toggleStreamVisibility(stream: StreamDetails) {
    if (!composer.getStream(stream.id)) return;
    composer.updateStream(stream.id, { hidden: !composer.getStream(stream.id)!.options.hidden });
    setStreams(streams.map(s => s.id === stream.id ? { ...s, options: { ...s.options, hidden: !s.options.hidden } } : s));
  }

  function removeStream(stream: StreamDetails) {
    composer.removeStream(stream.id);
    setStreams(streams.filter(s => s.id !== stream.id));
  }

  function onRecordClicked() {
      if (!isRecording) {
        composer.startRecording({
          uploadToken,
          videoName: uploadSettings.videoName,
          generateFileOnStop: uploadSettings.downloadVideoFile,
          mimeType: uploadSettings.mimeType,
          origin: {
            application: {
              name: "record-a-video",
              version: "1.0.0",
            }
          }
        });
        setVideoStatus("recording");
        composer.addEventListener("error", (e) => {
          setErrorMessage((e as any).data.title || "An unknown error occurred");
          setIsRecording(false);
        });
        composer.addEventListener("videoPlayable", (e) => {
          setVideoStatus("playable");
          setPlayerUrl((e as any).data.assets.player);
        });

        setPlayerUrl(null);
        setIsRecording(true);
      } else {
        composer.stopRecording().then(e => setVideoStatus("encoding"));
        setIsRecording(false);
      }
  }

  let stepNum = 0;
  if (videoStatus === "encoding") {
    stepNum = 1;
  }
  if (videoStatus === "playable") {
    stepNum = 2;
  }

  return (
    <>
      <div className={styles.container}>
        <ThemeProvider theme={theme}>
          <Head>
            <title>Video Recorder and Uploader</title>
            <meta name="description" content="records and uploads video" />
            <link rel="icon" href="/favicon.ico" />
          </Head>

            <Paper className={styles.settingsPaper} elevation={0}>
              <div className={styles.header}><NextImage src="/logo.svg" alt="api.video logo" width={65} height={15} /></div>
              <h2>
                <p>Select Video Source</p>
                <PopupState variant="popover" popupId="addStreamMenu">
                  {(popupState) => (
                    <React.Fragment>
                      <Tooltip title="Add" arrow><Button variant="text" {...bindTrigger(popupState)}><AddIcon fontSize='medium' sx={{ mr: 1 }} /></Button></Tooltip>
                      <Menu {...bindMenu(popupState)}>
                        <MenuItem onClick={async () => { popupState.close(); setAddStreamDialogOpen(true); }}>Add Video Camera...</MenuItem>
                      </Menu>
                    </React.Fragment>
                  )}
                </PopupState>
              </h2>

              {streams.length === 0
                ? (
                  <>
                    <NextImage className={styles.videoOff} src="/video-off.svg" alt='No stream' width={22} height={22} />
                    <p className={styles.noStream}><AddIcon fontSize='small' /> to add video streams</p>
                  </>
                ) : (
                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="streams">
                      {provided => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className={styles.droppable}>
                          {streams.map((stream, i) => (
                            <Draggable key={`${stream.id}_${i}`} draggableId={`${stream.id}_${i}`} index={i}>
                              {(provided, snapshot) => (
                                <div 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`${styles.stream} ${snapshot.isDragging ? styles.dragged : ''}`}
                                >
                                  <div data-svg="true" {...provided.dragHandleProps}>
                                    <DragIndicatorRoundedIcon />
                                  </div>
                                  <p>
                                    {stream.id}
                                  </p>
                                  <DeleteOutlineOutlinedIcon onClick={() => removeStream(stream)} />
                                  {stream.options.hidden 
                                    ? <VisibilityOffOutlinedIcon onClick={() => toggleStreamVisibility(stream)} /> 
                                    : <VisibilityOutlinedIcon onClick={() => toggleStreamVisibility(stream)} />
                                  }
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )
              }

              <h2>Select Mic or Audio Source</h2>
              <FormControl className={styles.formControl} fullWidth>
                <NextImage src="/mic.svg" alt="Microphone" width={16} height={16} />
                <Select
                  className={styles.audioSelect}
                  id="audio-source-select"
                  value={audioSource}
                  IconComponent={ExpandMoreIcon}
                  onChange={async (a) => {
                    if (audioStreamId) {
                      composer.removeAudioSource(audioStreamId);
                    }
                    const selectedAudioSource = a.target.value;
                    let newAudioStreamId;
                    if (selectedAudioSource !== "none") {
                      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedAudioSource } });
                      newAudioStreamId = await composer.addAudioSource(stream);
                    }
                    setAudioStreamId(newAudioStreamId);
                    setAudioSource(selectedAudioSource);
                  }}
                >
                  <MenuItem key={"undefined"} value={"none"}>None</MenuItem>
                  {audioDevices.map(d => <MenuItem key={d.deviceId} value={d.deviceId}>{d.label}</MenuItem>)}
                </Select>
              </FormControl>

              <SettingsIcon color='primary' onClick={() => setUploadSettingsDialogOpen(true)} className={styles.settingsButton} />

              <Tooltip style={{ fontSize: 22 }} title={<p style={{ fontSize: 16, padding: 0, margin: 0 }}>Start by adding one or more streams by clicking on the &quot;+&quot; icon above.</p>} placement='bottom' arrow disableHoverListener={streams.length > 0}>
                <span className={styles.recordContainer}>
                  <button className={styles.record} disabled={streams.length === 0} onClick={onRecordClicked}>
                    {!isRecording
                      ? <div><StartRecordingIcon fontSize="large" className={styles.toggleButtonIcon} />Start recording</div>
                      : <div><StopRoundedIcon style={{ color: '#DC3A3A' }} fontSize="large" className={styles.toggleButtonIcon} />Stop recording ({recordingDuration} sec)</div>
                    }
                  </button>
                </span>
              </Tooltip>
            </Paper>

            <section className={styles.previewPaper}>
              <div id="canvas-container" className={styles.canvasContainer} style={{ width: "100%", aspectRatio: `${WIDTH}/${HEIGHT}` }}>
                {streams.length === 0 && <><NextImage src="/video-off.svg" alt='No stream' width={48} height={48} /><p>No video stream yet</p></>}
              </div>
            </section>

            <Snackbar
              open={firstStreamAddedAlertOpen}
              onClose={() => setFirstStreamAddedAlertOpen(false)}
              autoHideDuration={4000}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              <Alert onClose={() => setFirstStreamAddedAlertOpen(false)} severity="success" sx={{ width: '100%' }}>
                You have added your first stream. You can now add more to create your composition!
              </Alert>
            </Snackbar>
            <Snackbar
              open={!!errorMessage}
              onClose={() => setErrorMessage(undefined)}
              autoHideDuration={4000}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              <Alert onClose={() => setErrorMessage(undefined)} severity="error" sx={{ width: '100%' }}>
                {errorMessage}
              </Alert>
            </Snackbar>

            <StreamDialog
              open={addStreamDialogIsOpen}
              devices={videoDevices}
              onClose={() => setAddStreamDialogOpen(false)}
              onSubmit={(values) => {
                addStream(values);
                setAddStreamDialogOpen(false);
              }} />

            <UploadSettingsDialog
              open={uploadSettingsDialogIsOpen}
              onClose={() => setUploadSettingsDialogOpen(false)}
              uploadSettings={uploadSettings}
              onSubmit={(values) => { setUploadSettings(values); setUploadSettingsDialogOpen(false) }} />

          {videoStatus && (
                <Box className={styles.stepperContainer}>
                  <Stepper activeStep={stepNum} connector={null} className={styles.stepper}>

                    <Step completed={stepNum > 0} className={styles.step}>
                      <StepLabel style={{ fontWeight: "bold" }}>Uploading</StepLabel>
                        <Typography variant="caption" className={styles.stepContent}>
                          The video is currently being recorded and uploaded simultaneously..
                        </Typography>
                    </Step>

                    <Step completed={stepNum > 1} className={styles.step}>
                      <StepLabel>Encoding</StepLabel>
                      {
                        stepNum > 0 &&
                          <Typography variant="caption">Your recording is currently being processed. Please wait.</Typography>
                      }
                    </Step>

                    <Step completed={stepNum > 1} className={styles.step}>
                      <StepLabel>Done</StepLabel>
                      {
                        stepNum > 1 &&
                          <>
                            <Typography variant="caption">
                              You can watch the recording <a href={playerUrl!} rel="noreferrer" target="_blank">by clicking here</a>.
                            </Typography><br />
                          </>
                      }
                    </Step>
                  </Stepper>
                </Box>
              )}

        </ThemeProvider>
      </div>
    </>
  )
}

export default Home
