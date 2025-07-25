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
