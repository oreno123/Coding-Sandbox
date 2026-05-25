!macro customInstall
  Delete "$DESKTOP\Screen Recorder.lnk"
  CreateShortCut "$DESKTOP\Screen Recorder.lnk" "$INSTDIR\Screen Recorder.exe" "" "$INSTDIR\resources\icon\keyusee.ico" 0

  Delete "$SMPROGRAMS\Screen Recorder.lnk"
  CreateShortCut "$SMPROGRAMS\Screen Recorder.lnk" "$INSTDIR\Screen Recorder.exe" "" "$INSTDIR\resources\icon\keyusee.ico" 0
!macroend
