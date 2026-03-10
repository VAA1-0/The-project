[Setup]
AppName=VAA1
AppVersion=1.0
DefaultDirName={autopf}\VAA1
DefaultGroupName=VAA1
OutputDir=.
OutputBaseFilename=VAA1_Setup
SetupIconFile=assets\icon.ico
Compression=lzma
SolidCompression=yes

[Files]
Source: "..\scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs
Source: "..\run_vaa1.bat"; DestDir: "{app}"
Source: "..\src\*"; DestDir: "{app}\src"; Flags: recursesubdirs
Source: "..\logs\*"; DestDir: "{app}\logs"; Flags: recursesubdirs createallsubdirs

[Icons]
Name: "{group}\VAA1"; Filename: "{app}\run_vaa1.bat"
Name: "{commondesktop}\VAA1"; Filename: "{app}\run_vaa1.bat"

[Run]
Filename: "{app}\run_vaa1.bat"; Description: "Launch VAA1"; Flags: nowait postinstall skipifsilent
