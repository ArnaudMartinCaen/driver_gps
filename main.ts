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
        Calcule le checksum d'une trame NMEA sans le $
        @param data Le texte sur lequel appliquer le XOR
    **/
    //% block="Calcul Checksum d'une trame $data"
    export function calculateChecksum(data: string): number {
        let checksum = 0
        for (let i = 1; i < data.length - 5; i++) {
            checksum ^= data.charCodeAt(i)
        }
        return checksum
    }

    /** 
        Vérifie le checksum d'une trame NMEA
        @param data LA trame à tester
    **/
    //% block="Validation d'une trame $data"
    export function checkTrame(data: string): boolean {
        return calculateChecksum(data) == parseInt(data.slice(-4, -2), 16)
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