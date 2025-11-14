#!/bin/bash
# Usage: ./free-space.sh /mnt/data 20 /mnt/backup [--dry-run]

MOUNT=$1
TARGET_FREE=$2
DEST=$3
DRY_RUN=false
BLACKLIST=("snapraid.content" "*.parity")

if [ -z "$MOUNT" ] || [ -z "$TARGET_FREE" ] || [ -z "$DEST" ]; then
    echo "Usage: $0 <mount> <target_free_%> <dest> [--dry-run]"
    exit 1
fi

if [ "$4" = "--dry-run" ]; then
    DRY_RUN=true
    echo "DRY RUN MODE - No files will be moved"
fi

read TOTAL_SIZE_KB CURRENT_AVAIL_KB CURRENT_FREE < <(df "$MOUNT" | awk 'NR==2 {print $2, $4, 100-$5}')

NEEDED_FREE_KB=$((TOTAL_SIZE_KB * TARGET_FREE / 100))
NEED_TO_FREE_KB=$((NEEDED_FREE_KB - CURRENT_AVAIL_KB))

if [ "$NEED_TO_FREE_KB" -le 0 ]; then
    NEED_TO_FREE_KB=0
fi

echo "Current free space: ${CURRENT_FREE}%"
echo "Target free space: ${TARGET_FREE}%"
echo "Need to free: $(numfmt --to=iec-i --suffix=B $((NEED_TO_FREE_KB * 1024)))"

if [ "$CURRENT_FREE" -ge "$TARGET_FREE" ]; then
    echo "Already have enough space!"
    exit 0
fi

FILE_COUNT=0
TOTAL_SIZE=0

while read -r _ size file; do
    if [ "$TOTAL_SIZE" -ge "$((NEED_TO_FREE_KB * 1024))" ]; then
        [ "$DRY_RUN" = true ] && echo "Would move $FILE_COUNT files totaling $(numfmt --to=iec-i --suffix=B $TOTAL_SIZE)"
        echo "Target reached!"
        break
    fi
    
    for pattern in "${BLACKLIST[@]}"; do
        [[ "$file" == *"$pattern"* ]] && continue 2
    done
    
    FILE_COUNT=$((FILE_COUNT + 1))
    TOTAL_SIZE=$((TOTAL_SIZE + size))
    
    if [ "$DRY_RUN" = true ]; then
        if [ $((FILE_COUNT % 100)) -eq 0 ]; then
            echo "Processed $FILE_COUNT files, $(numfmt --to=iec-i --suffix=B $TOTAL_SIZE) so far..."
        fi
    else
        rel_path="${file#$MOUNT/}"
        dest_file="$DEST/$rel_path"
        echo "Moving ($FILE_COUNT): $(basename "$file") [$(numfmt --to=iec-i --suffix=B $size)]"
        mkdir -p "$(dirname "$dest_file")"
        rsync -a --progress --remove-source-files "$file" "$dest_file"
    fi
done < <(find "$MOUNT" -type f -printf '%T@ %s %p\n' | sort -n)
