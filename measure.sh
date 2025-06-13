
branches=`git for-each-ref --format='%(refname:short)' refs/heads/ | grep "challenge_"`

# run the script execution
for branch in $branches; do
    git checkout $branch > /dev/null 2>&1
    
    real_times=()
    user_times=()

    # execute the script 5 times
    for i in {1..5}; do
        npm run start &> output
        
        # extract user time
        user_time=$(cat output | grep "Result real" | awk '{print $6}')
        real_time=$(cat output | grep "Result real" | awk '{print $7}')

        real_times+=($real_time)
        user_times+=($user_time)
    done

    # sort the times
    real_times=($(sort <<<"${real_times[*]}"))
    user_times=($(sort <<<"${user_times[*]}"))


    # remove the 2 extremes
    real_times=(${real_times[@]:1:3})
    user_times=(${user_times[@]:1:3})

    export LC_ALL=C

    # print the average
    real_average=$(printf "%s\n" "${real_times[@]}" | awk '{sum+=$1} END {print sum/NR}')
    user_average=$(printf "%s\n" "${user_times[@]}" | awk '{sum+=$1} END {print sum/NR}')

    author=$(git log -1 --format="%an" $branch)

    echo "$author / $branch / $real_average / $user_average"
done

