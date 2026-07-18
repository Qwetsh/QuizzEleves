-- CurioSnap — journalise la position du joueur à chaque screenshot.
-- Enregistre les coordonnées de ZONE (0-100, référence humaine) ET les
-- coordonnées normalisées sur la carte du CONTINENT (0-1, précision 5
-- décimales) — ces dernières servent directement de cx/cy au pipeline
-- Curioscope (aucune transformation zone→monde nécessaire côté outil).
--
-- Usage : se placer devant le point d'intérêt, Alt+Z pour masquer l'UI,
-- touche Impr. écran. Fin de session : /reload ou déconnexion PROPRE
-- (indispensable pour écrire SavedVariables sur disque).
-- Journal : WTF/Account/<COMPTE>/SavedVariables/CurioSnap.lua
-- Images  : Screenshots/WoWScrnShot_MMJJAA_HHMMSS.jpg (appariement par t)

local CONTINENT = 2 -- Enum.UIMapType.Continent

local f = CreateFrame("Frame")
f:RegisterEvent("ADDON_LOADED")
f:RegisterEvent("SCREENSHOT_SUCCEEDED")

-- Remonte la hiérarchie des cartes jusqu'au continent (mapType == 2).
local function findContinent(mapID)
    local id = mapID
    local info = C_Map.GetMapInfo(id)
    local guard = 0
    while info and info.mapType and info.mapType > CONTINENT
          and info.parentMapID and info.parentMapID > 0 and guard < 10 do
        id = info.parentMapID
        info = C_Map.GetMapInfo(id)
        guard = guard + 1
    end
    if info and info.mapType == CONTINENT then return id, info end
    return nil, nil
end

f:SetScript("OnEvent", function(self, event, arg1)
    if event == "ADDON_LOADED" and arg1 == "CurioSnap" then
        CurioSnapDB = CurioSnapDB or {}
    elseif event == "SCREENSHOT_SUCCEEDED" then
        local mapID = C_Map.GetBestMapForUnit("player")
        if not mapID then return end
        local pos = C_Map.GetPlayerMapPosition(mapID, "player")
        local info = C_Map.GetMapInfo(mapID)
        if not (pos and info) then return end

        local entry = {
            t    = date("%m%d%y_%H%M%S"),   -- même format que le nom du screenshot
            map  = mapID,
            zone = info.name,
            x    = math.floor(pos.x * 10000) / 100,   -- 0-100, 2 décimales
            y    = math.floor(pos.y * 10000) / 100,
        }

        -- Position sur la carte du CONTINENT (cx/cy normalisés 0-1).
        local contID, contInfo = findContinent(mapID)
        if contID then
            local cpos = C_Map.GetPlayerMapPosition(contID, "player")
            if cpos then
                entry.cont     = contID
                entry.contName = contInfo.name
                entry.cx       = math.floor(cpos.x * 100000) / 100000
                entry.cy       = math.floor(cpos.y * 100000) / 100000
            end
        end

        table.insert(CurioSnapDB, entry)
        if entry.cx then
            print(string.format("|cff33ff99CurioSnap|r %s %.2f, %.2f — %s %.1f%%, %.1f%% (#%d)",
                  entry.zone, entry.x, entry.y, entry.contName, entry.cx * 100, entry.cy * 100, #CurioSnapDB))
        else
            print(string.format("|cff33ff99CurioSnap|r %s %.2f, %.2f — |cffff6666hors continent|r (#%d)",
                  entry.zone, entry.x, entry.y, #CurioSnapDB))
        end
    end
end)
