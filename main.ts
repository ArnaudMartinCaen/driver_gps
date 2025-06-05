enum mySerialPin {
    //% block="P0"
    P0 = SerialPin.P0,
    //% block="P1"
    P1 = SerialPin.P1,
    //% block="P2"
    P2 = SerialPin.P2
}

enum TrameType {
    //% block="GNGGA"
    GNGGA,
    //% block="GNGLL"
    GNGLL,
    //% block="GPGSA"
    GPGSA,
    //% block="BDGSA"
    BDGSA,
    //% block="GPGSV"
    GPGSV,
    //% block="BDGSV"
    BDGSV,
    //% block="GNRMC"
    GNRMC,
    //% block="GNVTG"
    GNVTG,
    //% block="GNZDA"
    GNZDA,
    //% block="GPTXT"
    GPTXT
}

enum ChampTypeGGA {
    //% block="heure"
    heure = 0,
    //% block="latitude"
    latitude = 1,
    //% block="longitude"
    longitude = 2,
    //% block="fix"
    fix = 3,
    //% block="nbsat"
    nbsat = 4,
    //% block="altitude"
    altitude = 5
}

enum ChampTypeRMC {
    //% block="heure"
    heure = 0,
    //% block="latitude"
    latitude = 1,
    //% block="longitude"
    longitude = 2,
    //% block="etat"
    etat = 3,
    //% block="vitesse"
    vitesse = 4,
    //% block="route"
    route = 5,
    //% block="date"
    date = 6,
}

//% color="#AA278D" weight=100
namespace GPS_AT6558 {

    function toSerialPin(pin: mySerialPin): SerialPin {
        return pin as any as SerialPin
    }

    function nomTrame(t: TrameType): string {
        switch (t) {
            case TrameType.GNGGA: return "GNGGA"
            case TrameType.GNGLL: return "GNGLL"
            case TrameType.GPGSA: return "GPGSA"
            case TrameType.BDGSA: return "BDGSA"
            case TrameType.GPGSV: return "GPGSV"
            case TrameType.BDGSV: return "BDGSV"
            case TrameType.GNRMC: return "GNRMC"
            case TrameType.GNVTG: return "GNVTG"
            case TrameType.GNZDA: return "GNZDA"
            case TrameType.GPTXT: return "GPTXT"
            default: return ""
        }
    }

    /**
        Initialise le GPS sur la broche choisie
        @param rx Choix de la broche utilisée pour récupérer les données
    **/
    //% block="initialiser GPS sur broche %rx"
    //% rx.fieldEditor="gridpicker"
    //% rx.fieldOptions.columns=3
    //% rx.defl=mySerialPin.P0
    //% weight=100
    export function initGps(rx: mySerialPin): void {
        serial.redirect(SerialPin.USB_TX, toSerialPin(rx), 9600)
        serial.setTxBufferSize(128)
        serial.setRxBufferSize(128)
        serial.readUntil("\n") // nettoyer une trame éventuelle en attente
    }

    /**
        Récupération d'une trame compléte
        @param identifiant Le choix du type de trame à lire
        @param timeout Temps maximum en millisecondes
    **/
    //% block="Récupérer une trame du type $identifiant avec un timeout de $timeout"
    //% identifiant.defl=TrameType.GNGGA
    //% timeout.defl=5000 
    //% weight=98
    export function getTrameNMEA(identifiant: TrameType, timeout: number): string {
        let idTrame = nomTrame(identifiant)
        let start = control.millis()
        while (control.millis() - start < timeout) {
            const trame = serial.readUntil("\n").trim()
            if (trame && trame.includes(",")) {
                let id = trame.split(",")[0]
                if (id == "$" + idTrame) {
                    return trame
                }
            }
            basic.pause(10)
        }
        return ""
    }

    /** 
        Calcule le checksum d'une trame NMEA
        @param trame Le texte sur lequel appliquer le XOR
        @returns Valeur numérique du checksum (0–255)
    **/
    //% block="Calcul Checksum d'une trame $trame"
    //% weight=5
    export function calculateChecksum(trame: string): number {
        // Vérifie que la trame commence bien par '$' et contient '*'
        if (trame.charAt(0) != "$" || trame.indexOf("*") == -1) {
            return -1
        }
        // Extrait la portion entre $ et *
        let start = 1
        let end = trame.indexOf("*")
        let data = trame.slice(start, end)

        // Calcule le XOR de tous les caractères
        let checksum = 0
        for (let i = 0; i < data.length; i++) {
            checksum ^= data.charCodeAt(i)
        }
        return checksum
    }

    /** 
        Vérifie le checksum d'une trame NMEA
        @param trame La trame à tester
        @returns Booléen indiquant si le chechsum de la trame est bom
    **/
    //% block="Validation d'une trame $trame"
    //% weight=4
    export function checkTrame(trame: string): boolean {
        let sepIndex = trame.indexOf("*")
        if (trame.charAt(0) != "$" || sepIndex == -1) {
            return false
        }
        let expected = parseInt(trame.slice(sepIndex + 1, sepIndex + 3), 16)
        let actual = calculateChecksum(trame)
        return expected == actual
    }

    /** 
        Récupère la valeur d'un champ d'une trame GGA
        @param champ Le type de champ que l'on souhaite récupérer
        @param trame La trame GGA récupérée
        @returns Chaine de caractère du champ choisi
    **/
    //% block="Récupération du champ $champ dans la trame GGA $trame"
    //% champ.defl = ChampTypeGGA.heure
    //% weight=97
    export function getValueGNGGA(champ: ChampTypeGGA, trame: string): string {
        if (trame == "" || !checkTrame(trame)) {
            return ""
        }
        let champs = trame.split(",")
        switch (champ) {
            case ChampTypeGGA.heure:
                return (champs[1].slice(0, 2) + ":" + champs[1].slice(2, 4) + ":" + champs[1].slice(4))
            case ChampTypeGGA.latitude:
                let degLat = parseFloat(champs[2].slice(0, 2))
                let minLat = parseFloat(champs[2].slice(2))
                let latitude = degLat + minLat / 60
                if (champs[3] == "S") {
                    latitude = -latitude
                }
                return latitude.toString()
            case ChampTypeGGA.longitude:
                let degLon = parseFloat(champs[4].slice(0, 3))
                let minLon = parseFloat(champs[4].slice(3))
                let longitude = degLon + minLon / 60
                if (champs[5] == "W") {
                    longitude = -longitude
                }
                return longitude.toString()
            case ChampTypeGGA.fix:
                return champs[6]
            case ChampTypeGGA.nbsat:
                return champs[7]
            case ChampTypeGGA.altitude:
                return champs[9]
            default:
                return ""
        }
    }


    /** 
        Récupère la valeur d'un champ d'une trame RMC
        @param champ Le type de champ que l'on souhaite récupérer
        @param trame La trame RMC récupérée
        @returns Chaine de caractère du champ choisi
    **/
    //% block="Récupération du champ $champ dans la trame RMC $trame"
    //% champ.defl = ChampTypeRMC.heure
    //% weight=96
    export function getValueGNRMC(champ: ChampTypeRMC, trame: string): string {
        if (trame == "" || !checkTrame(trame)) {
            return ""
        }
        let champs = trame.split(",")
        switch (champ) {
            case ChampTypeRMC.heure:
                return (champs[1].slice(0, 2) + ":" + champs[1].slice(2, 4) + ":" + champs[1].slice(4))
            case ChampTypeRMC.latitude:
                let degLat = parseFloat(champs[3].slice(0, 2))
                let minLat = parseFloat(champs[3].slice(2))
                let latitude = degLat + minLat / 60
                if (champs[4] == "S") {
                    latitude = -latitude
                }
                return latitude.toString()
            case ChampTypeRMC.longitude:
                let degLon = parseFloat(champs[5].slice(0, 3))
                let minLon = parseFloat(champs[5].slice(3))
                let longitude = degLon + minLon / 60
                if (champs[6] == "W") {
                    longitude = -longitude
                }
                return longitude.toString()
            case ChampTypeRMC.etat:
                return champs[2]
            case ChampTypeRMC.vitesse:
                let vitesseNoeuds = parseFloat(champs[7])
                let vitesseKmH = vitesseNoeuds * 1.852
                return vitesseKmH.toString()
            case ChampTypeRMC.route:
                return champs[8]
            case ChampTypeRMC.date:
                return (champs[9].slice(0, 2) + "/" + champs[9].slice(2, 4) + "/" + champs[9].slice(4))
            default:
                return ""
        }
    }

    /** 
        Test si le module récupère des coordonnées
        @returns Booléen indiquant si le module récupère des coordonnées
    **/
    //% block="Test si le module récupère des coordonnées "
    //% weight=99
    export function hasFix(): boolean {
        let trame = getTrameNMEA(TrameType.GNGGA, 5000)
        let fixStr = getValueGNGGA(ChampTypeGGA.fix, trame);
        let fix = parseInt(fixStr);
        let trame2 = getTrameNMEA(TrameType.GNRMC, 5000)
        let etat = getValueGNRMC(ChampTypeRMC.etat, trame2);
        return !isNaN(fix) && fix >= 1 && etat == "A";
    }
}