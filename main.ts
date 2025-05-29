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
    export function calculateChecksum(trame: string): number {
        // Vérifie que la trame commence bien par '$' et contient '*'
        if (trame.charAt(0) != "$" || trame.indexOf("*") == -1) {
            return -1  // ou tu peux throw une erreur si tu préfères
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
        @param trame LA trame à tester
    **/
    //% block="Validation d'une trame $trame"
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
        Récupère la valeur de la latitude
    **/
    //% block="Récupération de la latitude "
    export function getLatitude(): number {
        let trame = getTrameNMEA(TrameType.GNGGA, 5000)
        while (checkTrame(trame) != true) {
            trame = getTrameNMEA(TrameType.GNGGA, 5000)
        }
        let liste_val = _py.py_string_split(trame, ",")
        if (liste_val[3] == "N") {
            return parseFloat(liste_val[2].slice(0, 2)) + parseFloat(liste_val[2].slice(2)) / 60
        }
        else {
            return -(parseFloat(liste_val[2].slice(0, 2)) + parseFloat(liste_val[2].slice(2)) / 60)
        }
    }

}