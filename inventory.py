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
            "etcd_s3_snapshots": {
                "enabled": True,
                "secret_name": "etcd-s3-config",
            },
            "etcd_snapshots": {
                "schedule_cron": "0 */6 * * *",
                "retention": 5,
                "compress": True,
            },
        },
        "alloy": {
            "telemetry_host": "telemetry.holdenitdown.net",
            "unix_exporter_enabled": False,
            "log_collection_enabled": False,
            "smartctl_exporter_enabled": True,
            "smartctl": {
                "interval": "60s",
                "rescan_interval": "10m",
                "device_exclude": "^(loop|ram|sr)",
            },
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
        "alloy": {
            "telemetry_host": "telemetry.holdenitdown.net",
            "unix_exporter_enabled": False,
            "log_collection_enabled": False,
            "smartctl_exporter_enabled": True,
            "smartctl": {
                "interval": "60s",
                "rescan_interval": "10m",
                "device_exclude": "^(loop|ram|sr)",
            },
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
        "alloy": {
            "telemetry_host": "telemetry.holdenitdown.net",
            "unix_exporter_enabled": False,
            "log_collection_enabled": False,
            "smartctl_exporter_enabled": True,
            "smartctl": {
                "interval": "60s",
                "rescan_interval": "10m",
                "device_exclude": "^(loop|ram|sr)",
            },
        },
    }),
    ("terra.holdenitdown.net", {
        "k3s_cluster": {
            "name": "romulus",
            "node_role": "agent",
            "api_host": "romulus.holdenitdown.net",
            "api_port": 6443,
            "labels": {
                "rholden.dev/vlan-access": "4",
            },
            "token": "1$2$bVdg-w3YgXtxvFp_Wpop1U4A1f6kiWG96UORsdwgX5s=$Z0FBQUFBQm9GTzE3dy14ZGtvaEtET2QxaXdMZE1GT2wtUmVOUGlnQUJrMVNiVUJrcHc4d25kWGV6QnlZREVUTlRZVTVLUm1NUGpGY1lkaERoUHRDNEI2Qmo0cGdadVlSS2pXMzFOWWdPOWhNUXBwNXZrTnpKaEtqUjBZbFVZY2RJYUk3T3AtcUVMaVU=",
        },
        "alloy": {
            "telemetry_host": "telemetry.holdenitdown.net",
            "unix_exporter_enabled": False,
            "log_collection_enabled": False,
            "smartctl_exporter_enabled": True,
            "smartctl": {
                "interval": "60s",
                "rescan_interval": "10m",
                "device_exclude": "^(loop|ram|sr)",
            },
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
                "rholden.dev/cpu": "intel",
            },
            "token": "1$2$RorsdcIvajXbasff9ST-yXn8us3Mmern6Trc0Smg70k=$Z0FBQUFBQm92enhpVUZhejE5TkZ1elBTOXRvUkJvcUlVSnJoV3BDbXZleElub0VtcHlLQ2J4Y1I5cEgxWE5seElMbVMyX01wdExkU3VPZEk0a0o0MmhNcWlOYXBqUEpkcjk2Z1RPZ0lTY1RYd1lCVnJXTEdVSFlCMlppdmpLYU00TE9IbUNiUUtkSXRNZEJzSmd3VGIyMi1CUGVfaGNOd2wtYlRZbUUtOUg5REF2c0hOZ1gtWHJRPQ==",
            "etcd_s3_snapshots": {
                "enabled": True,
                "secret_name": "etcd-s3-config",
            },
            "etcd_snapshots": {
                "schedule_cron": "0 */6 * * *",
                "retention": 5,
                "compress": True,
            },
        },
        "alloy": {
            "telemetry_host": "telemetry.holdenitdown.net",
            "unix_exporter_enabled": False,
            "log_collection_enabled": False,
            "smartctl_exporter_enabled": True,
            "smartctl": {
                "interval": "60s",
                "rescan_interval": "10m",
                "device_exclude": "^(loop|ram|sr)",
            },
        },
    }),
    ("vulkan.holdenitdown.net", {
        "k3s_cluster": {
            "name": "pantheon",
            "node_role": "agent",
            "api_host": "pantheon.holdenitdown.net",
            "api_port": 6443,
            "labels": {
                "rholden.dev/vlan-access": "3",
                "rholden.dev/gpu": "gfx1151",
                "rholden.dev/cpu": "amd",
            },
            "taints": [
                {"key": "workload-type", "value": "gpu-inference",
                    "effect": "NoSchedule"}
            ],
            "token": "1$2$RorsdcIvajXbasff9ST-yXn8us3Mmern6Trc0Smg70k=$Z0FBQUFBQm92enhpVUZhejE5TkZ1elBTOXRvUkJvcUlVSnJoV3BDbXZleElub0VtcHlLQ2J4Y1I5cEgxWE5seElMbVMyX01wdExkU3VPZEk0a0o0MmhNcWlOYXBqUEpkcjk2Z1RPZ0lTY1RYd1lCVnJXTEdVSFlCMlppdmpLYU00TE9IbUNiUUtkSXRNZEJzSmd3VGIyMi1CUGVfaGNOd2wtYlRZbUUtOUg5REF2c0hOZ1gtWHJRPQ==",
        },
        "alloy": {
            "telemetry_host": "telemetry.holdenitdown.net",
            "unix_exporter_enabled": False,
            "log_collection_enabled": False,
            "smartctl_exporter_enabled": True,
            "smartctl": {
                "interval": "60s",
                "rescan_interval": "10m",
                "device_exclude": "^(loop|ram|sr)",
            },
        },
    }),
    ("mars.holdenitdown.net", {
        "k3s_cluster": {
            "name": "pantheon",
            "node_role": "agent",
            "api_host": "pantheon.holdenitdown.net",
            "api_port": 6443,
            "labels": {
                "rholden.dev/vlan-access": "3",
                "rholden.dev/gpu": "cuda",
                "rholden.dev/cpu": "arm",
            },
            "taints": [
                {"key": "workload-type", "value": "gpu-inference",
                    "effect": "NoSchedule"}
            ],
            "token": "1$2$RorsdcIvajXbasff9ST-yXn8us3Mmern6Trc0Smg70k=$Z0FBQUFBQm92enhpVUZhejE5TkZ1elBTOXRvUkJvcUlVSnJoV3BDbXZleElub0VtcHlLQ2J4Y1I5cEgxWE5seElMbVMyX01wdExkU3VPZEk0a0o0MmhNcWlOYXBqUEpkcjk2Z1RPZ0lTY1RYd1lCVnJXTEdVSFlCMlppdmpLYU00TE9IbUNiUUtkSXRNZEJzSmd3VGIyMi1CUGVfaGNOd2wtYlRZbUUtOUg5REF2c0hOZ1gtWHJRPQ==",
        },
        "zfs_config": {
            "pools": {
                "nvme-pool": {
                    "devices": [
                        "/dev/disk/by-id/nvme-SOLIDIGM_SSDPFKKW020X7_SSC7N448911107B6Y",
                        "/dev/disk/by-id/nvme-SOLIDIGM_SSDPFKKW020X7_SSC7N449310707E5T",
                        "mirror",
                        "/dev/disk/by-id/nvme-SOLIDIGM_SSDPFKKW020X7_SDC7N43671050783F",
                        "/dev/disk/by-id/nvme-SOLIDIGM_SSDPFKKW020X7_SDC7N458710907D4F",
                    ],
                    "type": "mirror",
                    "ashift": 12
                }
            },
            "datasets": {
                "nvme-pool/export": {
                    "mountpoint": "/export/",
                    "sharenfs": "rw,all_squash,anonuid=0,anongid=0",
                    "compression": "on"
                },
                "nvme-pool/export/models": {
                    "mountpoint": "/export/models",
                    "sharenfs": "rw,all_squash,anonuid=0,anongid=0",
                    "quota": "1T",
                    "compression": "on"
                }
            }
        },
        "alloy": {
            "telemetry_host": "telemetry.holdenitdown.net",
            "unix_exporter_enabled": False,
            "log_collection_enabled": False,
            "smartctl_exporter_enabled": True,
            "smartctl": {
                "interval": "60s",
                "rescan_interval": "10m",
                "device_exclude": "^(loop|ram|sr)",
            },
        },
    }),
    ("172.16.4.202", {
        "k3s_cluster": {
            "name": "pantheon",
            "node_role": "agent",
            "api_host": "pantheon.holdenitdown.net",
            "api_port": 6443,
            "labels": {
                "rholden.dev/vlan-access": "4",
            },
            "token": "1$2$RorsdcIvajXbasff9ST-yXn8us3Mmern6Trc0Smg70k=$Z0FBQUFBQm92enhpVUZhejE5TkZ1elBTOXRvUkJvcUlVSnJoV3BDbXZleElub0VtcHlLQ2J4Y1I5cEgxWE5seElMbVMyX01wdExkU3VPZEk0a0o0MmhNcWlOYXBqUEpkcjk2Z1RPZ0lTY1RYd1lCVnJXTEdVSFlCMlppdmpLYU00TE9IbUNiUUtkSXRNZEJzSmd3VGIyMi1CUGVfaGNOd2wtYlRZbUUtOUg5REF2c0hOZ1gtWHJRPQ==",
        },
    }),
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
        "alloy": {
            "telemetry_host": "telemetry.holdenitdown.net",
            "smartctl_exporter_enabled": True,
            "smartctl": {
                "interval": "60s",
                "rescan_interval": "10m",
                "device_exclude": "^(loop|ram|sr)",
            },
        },
    }),
    ("172.16.4.11", {
        "snapraid_config": {
            "parity_disks": [
                {
                    "name": "parity",
                    "path": "/mnt/hdd0/snapraid.parity",
                    "uuid": "7039a8ac-e596-4179-837f-4b6a2cac1451",
                    "mount_point": "/mnt/hdd0"
                },
                {
                    "name": "2-parity",
                    "path": "/mnt/hdd10/snapraid.parity",
                    "uuid": "9de9504f-7810-4cc4-9c04-386713de537a",
                    "mount_point": "/mnt/hdd10"
                }
            ],
            "content_files": [
                "/mnt/hdd0/snapraid.content",
                "/mnt/hdd10/snapraid.content",
                "/mnt/hdd1/snapraid.content",
                "/mnt/hdd11/snapraid.content"
            ],
            "data_disks": [
                {
                    "name": "d1",
                    "path": "/mnt/hdd1/",
                    "uuid": "775ffcaa-5f04-4dbd-a571-e93e3500fee3"
                },
                {
                    "name": "d2",
                    "path": "/mnt/hdd2/",
                    "uuid": "6dfc5a20-006e-4241-8887-b9d03d3b6ea7"
                },
                {
                    "name": "d3",
                    "path": "/mnt/hdd3/",
                    "uuid": "a01b4608-fb3c-498c-8aaa-d89767777c4d"
                },
                {
                    "name": "d4",
                    "path": "/mnt/hdd11/",
                    "uuid": "303469d1-b592-4f3b-b508-4f5461303c94"
                },
                {
                    "name": "d5",
                    "path": "/mnt/hdd12/",
                    "uuid": "fd8f72f3-f7c7-492d-9e30-1df15694a4c8"
                },
                {
                    "name": "d6",
                    "path": "/mnt/hdd13/",
                    "uuid": "487fef50-af60-4d03-9d08-a6b26a6e3165"
                },
                {
                    "name": "d7",
                    "path": "/mnt/hdd4/",
                    "uuid": "ffb277e5-0ed9-45c4-b71f-abc54c8dda7d"
                },
            ],
            "schedule": {
                "sync": {
                    "enabled": True,
                    "time": "06:00",
                    "frequency": "daily"
                },
                "scrub": {
                    "enabled": True,
                    "day": "sunday",
                    "time": "08:00",
                    "percentage": 8,
                    "frequency": "weekly"
                },
                "smart": {
                    "enabled": True,
                    "time": "05:30",
                    "frequency": "daily"
                }
            }
        },
        "mergerfs_config": {
            "pools": [
                {
                    "name": "movies",
                    "sources": ["/mnt/hdd1", "/mnt/hdd2", "/mnt/hdd3", "/mnt/hdd4"],
                    "mount_point": "/export/movies",
                    "options": "cache.files=off,dropcacheonclose=false,category.create=mfs"
                },
                {
                    "name": "series",
                    "sources": ["/mnt/hdd11", "/mnt/hdd12", "/mnt/hdd13"],
                    "mount_point": "/export/series",
                    "options": "cache.files=off,dropcacheonclose=false,category.create=mfs"
                }
            ],
            "nfs_export": {
                "enabled": True,
                "exports": [
                    {
                        "mount_point": "/export/movies",
                        "options": "fsid=2,rw,sync,no_subtree_check,all_squash,anonuid=0,anongid=0"
                    },
                    {
                        "mount_point": "/export/series",
                        "options": "fsid=1,rw,sync,no_subtree_check,all_squash,anonuid=0,anongid=0"
                    }
                ]
            }
        },
        "disk_mounts": [
            {"uuid": "7039a8ac-e596-4179-837f-4b6a2cac1451",
                "mount": "/mnt/hdd0", "fstype": "xfs"},
            {"uuid": "775ffcaa-5f04-4dbd-a571-e93e3500fee3",
                "mount": "/mnt/hdd1", "fstype": "xfs"},
            {"uuid": "6dfc5a20-006e-4241-8887-b9d03d3b6ea7",
                "mount": "/mnt/hdd2", "fstype": "xfs"},
            {"uuid": "a01b4608-fb3c-498c-8aaa-d89767777c4d",
                "mount": "/mnt/hdd3", "fstype": "xfs"},
            {"uuid": "9de9504f-7810-4cc4-9c04-386713de537a",
                "mount": "/mnt/hdd10", "fstype": "xfs"},
            {"uuid": "303469d1-b592-4f3b-b508-4f5461303c94",
                "mount": "/mnt/hdd11", "fstype": "xfs"},
            {"uuid": "fd8f72f3-f7c7-492d-9e30-1df15694a4c8",
                "mount": "/mnt/hdd12", "fstype": "xfs"},
            {"uuid": "487fef50-af60-4d03-9d08-a6b26a6e3165",
                "mount": "/mnt/hdd13", "fstype": "xfs"},
            {"uuid": "ffb277e5-0ed9-45c4-b71f-abc54c8dda7d",
                "mount": "/mnt/hdd4", "fstype": "xfs"},
        ],
        "alloy": {
            "telemetry_host": "telemetry.holdenitdown.net"
        }
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
        },
        "alloy": {
            "telemetry_host": "telemetry.holdenitdown.net"
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
        },
        "alloy": {
            "telemetry_host": "telemetry.holdenitdown.net"
        }
    }),
]

alloy = [
    ("sol.holdenitdown.net"),
    ("aurora.holdenitdown.net"),
    ("luna.holdenitdown.net"),
    ("apollo.holdenitdown.net"),
    ("vulkan.holdenitdown.net"),
    ("mars.holdenitdown.net"),
    ("phobos.holdenitdown.net"),
    ("deimos.holdenitdown.net"),
    ("172.16.4.10"),
    ("172.16.4.11"),
]
