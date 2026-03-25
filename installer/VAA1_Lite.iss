[Setup]
AppName=VAA1 Lite
AppVersion=1.0
DefaultDirName={autopf}\VAA1-Lite
DefaultGroupName=VAA1 Lite
OutputBaseFilename=VAA1_Lite_Setup
PrivilegesRequired=lowest
Compression=lzma
SolidCompression=yes

[Files]
Source: "..\run_vaa1_lite.bat"; DestDir: "{app}"
Source: "..\scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs
Source: "..\src\frontend\*"; DestDir: "{app}\src\frontend"; Flags: recursesubdirs

[Icons]
Name: "{group}\VAA1 Lite"; Filename: "{app}\run_vaa1_lite.bat"
Name: "{commondesktop}\VAA1 Lite"; Filename: "{app}\run_vaa1_lite.bat"

[Run]
Filename: "{app}\run_vaa1_lite.bat"; Description: "Launch VAA1 Lite"; Flags: nowait postinstall skipifsilent
