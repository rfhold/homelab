# PyInfra Inventory File
# Defines a 3-node cluster
romulus = [
    ("sol.holdenitdown.net", {
        "k3s_cluster": {
            "name": "romulus",
            "node_role": "cluster-init",
            "api_host": "romulus.holdenitdown.net",
            "api_port": 6443,
            "labels": {
                "rholden.dev/vlan-access": "4",
            },
            "token": "1$2$bVdg-w3YgXtxvFp_Wpop1U4A1f6kiWG96UORsdwgX5s=$Z0FBQUFBQm9GTzE3dy14ZGtvaEtET2QxaXdMZE1GT2wtUmVOUGlnQUJrMVNiVUJrcHc4d25kWGV6QnlZREVUTlRZVTVLUm1NUGpGY1lkaERoUHRDNEI2Qmo0cGdadVlSS2pXMzFOWWdPOWhNUXBwNXZrTnpKaEtqUjBZbFVZY2RJYUk3T3AtcUVMaVU=",
        },
    }),
    ("aurora.holdenitdown.net", {
        "k3s_cluster": {
            "name": "romulus",
            "node_role": "server",
            "api_host": "romulus.holdenitdown.net",
            "api_port": 6443,
            "labels": {
                "rholden.dev/vlan-access": "5",
            },
            "token": "1$2$bVdg-w3YgXtxvFp_Wpop1U4A1f6kiWG96UORsdwgX5s=$Z0FBQUFBQm9GTzE3dy14ZGtvaEtET2QxaXdMZE1GT2wtUmVOUGlnQUJrMVNiVUJrcHc4d25kWGV6QnlZREVUTlRZVTVLUm1NUGpGY1lkaERoUHRDNEI2Qmo0cGdadVlSS2pXMzFOWWdPOWhNUXBwNXZrTnpKaEtqUjBZbFVZY2RJYUk3T3AtcUVMaVU=",
        },
    }),
    ("luna.holdenitdown.net", {
        "k3s_cluster": {
            "name": "romulus",
            "node_role": "server",
            "api_host": "romulus.holdenitdown.net",
            "api_port": 6443,
            "labels": {
                "rholden.dev/vlan-access": "100",
            },
            "token": "1$2$bVdg-w3YgXtxvFp_Wpop1U4A1f6kiWG96UORsdwgX5s=$Z0FBQUFBQm9GTzE3dy14ZGtvaEtET2QxaXdMZE1GT2wtUmVOUGlnQUJrMVNiVUJrcHc4d25kWGV6QnlZREVUTlRZVTVLUm1NUGpGY1lkaERoUHRDNEI2Qmo0cGdadVlSS2pXMzFOWWdPOWhNUXBwNXZrTnpKaEtqUjBZbFVZY2RJYUk3T3AtcUVMaVU=",
        },
    })
]

pantheon = [
    ("apollo.holdenitdown.net", {
        "k3s_cluster": {
            "name": "pantheon",
            "node_role": "cluster-init",
            "api_host": "pantheon.holdenitdown.net",
            "api_port": 6443,
            "labels": {
                "rholden.dev/vlan-access": "3",
            },
            "token": "1$2$RorsdcIvajXbasff9ST-yXn8us3Mmern6Trc0Smg70k=$Z0FBQUFBQm92enhpVUZhejE5TkZ1elBTOXRvUkJvcUlVSnJoV3BDbXZleElub0VtcHlLQ2J4Y1I5cEgxWE5seElMbVMyX01wdExkU3VPZEk0a0o0MmhNcWlOYXBqUEpkcjk2Z1RPZ0lTY1RYd1lCVnJXTEdVSFlCMlppdmpLYU00TE9IbUNiUUtkSXRNZEJzSmd3VGIyMi1CUGVfaGNOd2wtYlRZbUUtOUg5REF2c0hOZ1gtWHJRPQ==",
        },
    })
]

nas = [
    ("172.16.4.10", {
        "zfs_config": {
            "pools": {
                "ssd-pool1": {
                    "devices": [
                        "/dev/disk/by-id/ata-Samsung_SSD_870_QVO_8TB_S5VUNJ0X901317Z",
                        "/dev/disk/by-id/ata-Samsung_SSD_870_QVO_8TB_S5VUNJ0X901248B",
                        "/dev/disk/by-id/ata-Samsung_SSD_870_QVO_8TB_S5VUNJ0X901353X",
                    ],
                    "type": "raidz1",
                    "ashift": 12
                }
            },
            "datasets": {
                "ssd-pool1/export": {
                    "mountpoint": "/export/",
                    "sharenfs": "rw,all_squash,anonuid=0,anongid=0",
                    "compression": "on"
                },
                "ssd-pool1/export/backup": {
                    "mountpoint": "/export/backup",
                    "sharenfs": "rw,all_squash,anonuid=0,anongid=0",
                    "quota": "2T",
                    "compression": "on"
                },
                "ssd-pool1/export/downloads": {
                    "mountpoint": "/export//downloads",
                    "sharenfs": "rw,all_squash,anonuid=0,anongid=0",
                    "quota": "2T",
                    "compression": "on"
                },
                "ssd-pool1/export/nvr": {
                    "mountpoint": "/export/nvr",
                    "sharenfs": "rw,all_squash,anonuid=0,anongid=0",
                    "quota": "1T",
                    "compression": "on"
                }
            }
        },
    }),
]

voice = [
    ("phobos.holdenitdown.net", {
        "wyoming_satellite": {
            "name": "phobos",
            "uri": "tcp://0.0.0.0:10700",
            "audio": {
                "mic_device": "plughw:CARD=seeed2micvoicec,DEV=0",
                "speaker_device": "plughw:CARD=seeed2micvoicec,DEV=0"
            },
            "wake_word": {
                "enabled": True,
                "uri": "tcp://127.0.0.1:10400",
                "name": "ok_nabu",
                "custom_models": [
                    {
                        "name": "mirror_mirror_on_the_wall",
                        "url": "https://github.com/fwartner/home-assistant-wakewords-collection/raw/main/en/mirror_mirror_on_the_wall/mirror_mirror_on_the_wall.tflite"
                    }
                ],
                "preload_models": ["mirror_mirror_on_the_wall"]
            },
            "led_service": {
                "enabled": True,
                "type": "2mic",
                "uri": "tcp://127.0.0.1:10500",
                "brightness": 2
            },
            "enhancements": {
                "auto_gain": 5,
                "noise_suppression": 2,
            },
        },
        "respeaker_hat": {
            "enabled": True
        }
    }),
    ("deimos.holdenitdown.net", {
        "wyoming_satellite": {
            "name": "deimos",
            "uri": "tcp://0.0.0.0:10700",
            "audio": {
                "mic_device": "plughw:CARD=seeed2micvoicec,DEV=0",
                "speaker_device": "plughw:CARD=seeed2micvoicec,DEV=0"
            },
            "wake_word": {
                "enabled": True,
                "uri": "tcp://127.0.0.1:10400",
                "name": "ok_nabu",
                "custom_models": [
                    {
                        "name": "mirror_mirror_on_the_wall",
                        "url": "https://github.com/fwartner/home-assistant-wakewords-collection/raw/main/en/mirror_mirror_on_the_wall/mirror_mirror_on_the_wall.tflite"
                    }
                ],
                "preload_models": ["mirror_mirror_on_the_wall"]
            },
            "led_service": {
                "enabled": True,
                "type": "2mic",
                "uri": "tcp://127.0.0.1:10500",
                "brightness": 2
            },
            "enhancements": {
                "auto_gain": 5,
                "noise_suppression": 2,
            },
        },
        "respeaker_hat": {
            "enabled": True
        }
    }),
]
